import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { iptvOrgApi } from './services/iptvOrgApi';
import usePlayerStore from './zustand/playerStore';
import { strFromU8 } from 'fflate';

const inflightRequests = {};

// In-memory cache for EPG sources and parsed programs to eliminate lag
const epgCache = {
  // Map of URL -> { programs: Program[], timestamp: number }
  parsed: new Map(),
  // Map of URL -> { rawData: string, timestamp: number }
  raw: new Map(),
  
  // Cache expiry (30 minutes)
  EXPIRY: 30 * 60 * 1000,
  
  getParsed(url) {
    const item = this.parsed.get(url);
    if (item && (Date.now() - item.timestamp < this.EXPIRY)) return item.programs;
    return null;
  },
  
  getRaw(url) {
    const item = this.raw.get(url);
    if (item && (Date.now() - item.timestamp < this.EXPIRY)) return item.rawData;
    return null;
  },
  
  setParsed(url, programs) {
    this.parsed.set(url, { programs, timestamp: Date.now() });
  },
  
  setRaw(url, rawData) {
    this.raw.set(url, { rawData, timestamp: Date.now() });
  }
};

/**
 * IPTV M3U & EPG Parser
 * Uses iptv-org REST API for reliable channel matching and logo enrichment.
 * Falls back to country-level XML EPG for schedule/program data.
 */
export const iptvParser = {
  /**
   * Fetch channels by country code (M3U)
   */
  async fetchByCountry(countryCode = 'in') {
    const url = `https://iptv-org.github.io/iptv/countries/${countryCode}.m3u`;
    return this.fetchAndParse(url);
  },

  cleanName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .split('(')[0] // Remove anything after brackets
      .replace(/^(in|us|uk|ca|au|fr|de|it|es|br|mx|ru|jp|cn|kr|ae|sa|za|tr|pk|bd|id|vn|th|my|ph|ng|eg|mx|ar|cl|co|pe|ve|eg|pl|nl|be|se|no|dk|fi|gr|pt|ro|ua|bg|hu|cz|sk|rs|hr|si|ee|lv|lt|is|ie|lu|mc|ad|li|mt|cy|il|jo|qa|kw|om|bh|af|lk|np|mm|kh|la|mn|kp|tw|hk|mo|sg|nz|fj|pg|vu|sb|tl|pw|fm|mh|ki|nr|ws|to|as|gu|mp|um|as|vi|pr|io|sh|fk|gs|gi|tc|ky|bm|ms|vg|ai|ax|aw|cw|sx|bq|pm|yt|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck)\s*-\s*/gi, '') // Remove country prefixes like "IN - "
      .replace(/[^a-z0-9+]/g, ' ') // Keep '+' (common in channel names) and replace other specials with space
      .replace(/\s+/g, ' ') // Collapse spaces
      .trim();
  },

  async fetchByLanguage(langCode) {
    const url = `https://iptv-org.github.io/iptv/languages/${langCode}.m3u`;
    return this.fetchAndParse(url);
  },

  async fetchAndParse(url) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return this.parse(response.data);
    } catch (error) {
      console.error('Error fetching M3U:', error);
      throw error;
    }
  },

  parse(m3uText) {
    const lines = m3uText.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        currentChannel = {
          name: '',
          url: '',
          logo: '',
          category: 'Other',
          tvgId: '',
          iptvOrgId: null,
        };

        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) currentChannel.logo = logoMatch[1];

        const categoryMatch = line.match(/group-title="([^"]+)"/);
        if (categoryMatch) currentChannel.category = categoryMatch[1];

        const idMatch = line.match(/tvg-id="([^"]+)"/);
        if (idMatch) currentChannel.tvgId = idMatch[1];

        const countryMatch = line.match(/tvg-country="([^"]+)"/);
        if (countryMatch) currentChannel.country = countryMatch[1];

        const langMatch = line.match(/tvg-language="([^"]+)"/);
        if (langMatch) currentChannel.language = langMatch[1];

        const nameParts = line.split(',');
        currentChannel.name = nameParts[nameParts.length - 1].trim();

        // 4. Quality Detection
        const nameUpper = currentChannel.name.toUpperCase();
        if (nameUpper.includes('4K') || nameUpper.includes('UHD') || nameUpper.includes('2160')) {
          currentChannel.quality = '4K';
        } else if (nameUpper.includes('FHD') || nameUpper.includes('1080') || nameUpper.includes('HEVC')) {
          currentChannel.quality = 'FHD';
        } else if (nameUpper.includes('HD') || nameUpper.includes('720')) {
          currentChannel.quality = 'HD';
        } else {
          currentChannel.quality = 'SD';
        }
      } else if (line.startsWith('http') && currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
    return channels;
  },

  /**
   * Bundle-specific fetch for local Indian EPG XML.
   * Parses and caches the 10MB+ file in memory.
   */
  async fetchLocalEPG() {
    const localUrl = 'local://epg-in.xml';
    let programsDict = epgCache.getParsed(localUrl);
    if (programsDict) return programsDict;

    try {
      console.log('📡 Syncing Local Premium EPG...');
      const asset = Asset.fromModule(require('../epg/epg-in.xml'));
      await asset.downloadAsync();
      const finalData = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
      
      if (finalData) {
        const dict = await this.parseEPG(finalData);
        epgCache.setParsed(localUrl, dict);
        console.log('[EPG] Local Sync Complete');
        return dict;
      }
    } catch (e) {
      console.warn('[EPG] Local sync failed fallback to network:', e);
    }
    return {};
  },

  /**
   * Fetch EPG schedule for a channel using the iptv-org API for ID resolution,
   * then download the country XML for program data.
   *
   * @param {object} channel - { tvgId, name, logo, category, url }
   * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. 'in', 'us')
   * @returns {Promise<Program[]>}
   */
  async fetchEPGForChannel(channel, countryCode = 'in', skipEnrichment = false) {
    if (!channel || !channel.url) return [];
    
    // Check if EPG is globally disabled
    const { disableEpg } = usePlayerStore.getState();
    if (disableEpg) return [];

    // Step 0: Try Local Bundled EPG if country is India
    if (countryCode.toLowerCase() === 'in' || (channel.country && channel.country.toLowerCase() === 'in')) {
       try {
         const localDict = await this.fetchLocalEPG();
         const filtered = this.getProgramsForChannel(localDict, channel);
         if (filtered && filtered.length > 0) {
            console.log(`[EPG] Found schedule for "${channel.name}" in local bundle`);
            return filtered;
         }
       } catch (e) {}
    }

    // Step 1: Resolve canonical channel ID via iptv-org API
    let resolvedId = channel.iptvOrgId || null;
    let resolvedTvgId = channel.tvgId || null;

    if (!resolvedId && !skipEnrichment) {
      try {
        const enriched = await iptvOrgApi.enrichChannel(
          channel.tvgId,
          channel.name,
          countryCode.toUpperCase(),
          channel.logo,
        );
        resolvedId = enriched.iptvOrgId;
        console.log(`[EPG] Resolved channel "${channel.name}" → ${resolvedId}`);
      } catch (e) {
        console.warn('[EPG] Channel enrichment failed, will try name matching');
      }
    }

    // Map country code to GlobeTV App format
    const lowerCode = countryCode.toLowerCase();
    const overrides = {
      us: 'Usa', gb: 'Unitedkingdom', kr: 'Korea', ae: 'Uae',
      cz: 'Czech', do: 'Dominican', sv: 'Elsalvador', ci: 'Ivorycoast',
      cr: 'Costarica', hk: 'Hongkong', nc: 'Newcaledonia', nz: 'Newzealand',
      pr: 'Puertorico', sa: 'Saudiarabia', za: 'Southafrica', ba: 'Bosnia'
    };
    
    let globeTvCountry = overrides[lowerCode];
    if (!globeTvCountry) {
      try {
        const countries = await iptvOrgApi.fetchCountries();
        const countryObj = countries.find(c => c.code.toLowerCase() === lowerCode);
        if (countryObj) {
          let name = countryObj.name.replace(/[^a-zA-Z]/g, '');
          if (name) {
             globeTvCountry = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          }
        }
      } catch (e) {
        console.warn('[EPG] Failed to fetch countries for mapping');
      }
    }

    // Step 2: Fetch country XML and parse
    const sources = [
      `https://iptv-org.github.io/epg/guides/${lowerCode}.xml`,
      `https://epghub.pages.dev/${lowerCode}.xml`,
    ];

    if (lowerCode === 'in') {
      sources.unshift('https://raw.githubusercontent.com/angel7544/vega-app/orbix-personal/src/epg/epg-in.xml');
    }

    if (globeTvCountry) {
      const gFolders = [
        `https://raw.githubusercontent.com/globetvapp/epg/main/${globeTvCountry}/${globeTvCountry.toLowerCase()}1.xml`,
        `https://raw.githubusercontent.com/globetvapp/epg/main/${globeTvCountry}/${globeTvCountry.toLowerCase()}2.xml`,
        `https://raw.githubusercontent.com/globetvapp/epg/main/${globeTvCountry}/${globeTvCountry.toLowerCase()}3.xml`,
        `https://raw.githubusercontent.com/globetvapp/epg/main/${globeTvCountry}/${globeTvCountry.toLowerCase()}4.xml`
      ];
      // Prepend globetvapp sources so they are checked first
      sources.unshift(...gFolders);
    }

    const { customEpgUrl } = usePlayerStore.getState();
    if (customEpgUrl) {
      sources.unshift(customEpgUrl);
    }

    for (const source of sources) {
      try {
        console.log(`📡 Checking EPG Source: ${source}`);

        let programsDict = epgCache.getParsed(source);
        
        if (!programsDict) {
           if (!inflightRequests[source]) {
               inflightRequests[source] = (async () => {
                    let finalData = null;
                    
                    // Always request as arraybuffer to prevent string corruption of binary data
                    let response = await axios.get(source, { 
                        timeout: 30000, 
                        responseType: 'arraybuffer' 
                    });
                    
                    const buffer = new Uint8Array(response.data);
                    
                    // Direct text decoding (gzip support removed)
                    if (typeof TextDecoder !== 'undefined') {
                        finalData = new TextDecoder('utf-8').decode(buffer);
                    } else {
                        finalData = strFromU8(buffer);
                    }
                    
                    if (finalData) {
                        const dict = await this.parseEPG(finalData);
                        epgCache.setParsed(source, dict);
                        return dict;
                    }
                    return {};
               })();
           }
           
           try {
              programsDict = await inflightRequests[source];
           } catch (e) {
              delete inflightRequests[source];
              throw e;
           }
           
           // Clear lock after a few seconds so memory cache manages it naturally
           setTimeout(() => delete inflightRequests[source], 5000);
        }

        const filtered = this.getProgramsForChannel(
          programsDict,
          channel,
          resolvedId,
          resolvedTvgId,
        );
        if (filtered && filtered.length > 0) {
          console.log(`[EPG] Found ${filtered.length} programs for "${channel.name}" from ${source}`);
          return filtered;
        }
      } catch (error) {
        console.warn(`⚠️ EPG source failed: ${source}`);
      }
    }

    return [];
  },

  /**
   * Parse EPG XML using a lightweight regex-based approach (no cheerio dependency).
   * Returns a Dictionary mapping `channelId` to an array of program objects.
   * 
   * @param {string} xmlText
   */
  async parseEPG(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') return {};
    try {
      const channelMap = {};
      const programsDict = {};
      let yieldCounter = 0;

      // High-performance substring parsing for channels
      let cIdx = xmlText.indexOf('<channel ');
      while (cIdx !== -1) {
        const endAttr = xmlText.indexOf('>', cIdx);
        if (endAttr === -1) break;
        const endC = xmlText.indexOf('</channel>', endAttr);
        if (endC === -1) break;

        const attrs = xmlText.substring(cIdx + 9, endAttr);
        const body = xmlText.substring(endAttr + 1, endC);

        const idMatch = attrs.match(/id="([^"]+)"/);
        if (idMatch) {
          const dnMatch = body.match(/<display-name[^>]*>([^<]+)<\/display-name>/);
          if (dnMatch) {
            channelMap[idMatch[1]] = dnMatch[1].trim().toLowerCase();
          }
        }
        
         // Yield every 50 channels for large bundled files
         if (++yieldCounter % 50 === 0) {
            await this.yieldToUI();
         }


        cIdx = xmlText.indexOf('<channel ', endC + 10);
      }

      // High-performance substring parsing for programmes
      let pIdx = xmlText.indexOf('<programme ');
      yieldCounter = 0;
      
      while (pIdx !== -1) {
        const endAttr = xmlText.indexOf('>', pIdx);
        if (endAttr === -1) break;
        const endP = xmlText.indexOf('</programme>', endAttr);
        if (endP === -1) break;

        const attrs = xmlText.substring(pIdx + 11, endAttr);
        
        const channelAttr = attrs.match(/channel="([^"]+)"/);
        const channelId = (channelAttr?.[1] || '').toLowerCase();
        const channelName = channelMap[channelId] || '';

        const body = xmlText.substring(endAttr + 1, endP);

        const startAttr = attrs.match(/start="([^"]+)"/);
        const stopAttr = attrs.match(/stop="([^"]+)"/);

        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/);
        const descMatch = body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
        const iconMatch = body.match(/<icon\s+src="([^"]+)"/);
        const categoryMatch = body.match(/<category[^>]*>([^<]+)<\/category>/);

        const rawStart = startAttr?.[1] || '';
        const rawStop = stopAttr?.[1] || '';

        const progObj = {
          channelId,
          channelName,
          start: this.formatEPGTime(rawStart),
          stop: this.formatEPGTime(rawStop),
          startTs: this.epgTimeToTimestamp(rawStart),
          stopTs: this.epgTimeToTimestamp(rawStop),
          title: titleMatch?.[1]?.trim() || 'Untitled',
          desc: descMatch?.[1]?.trim().replace(/<[^>]+>/g, '') || '',
          icon: iconMatch?.[1] || null,
          category: categoryMatch?.[1]?.trim() || null,
          rawStart,
          rawStop,
        };

        if (!programsDict[channelId]) {
           programsDict[channelId] = [];
        }
        programsDict[channelId].push(progObj);

         // Yield every 100 programs for large bundled files
         if (++yieldCounter % 100 === 0) {
            await this.yieldToUI();
         }


        pIdx = xmlText.indexOf('<programme ', endP + 12);
      }

      // Sort programs within their dictionaries by start time for fast querying later
      for (const chId in programsDict) {
        programsDict[chId].sort((a, b) => a.startTs - b.startTs);
      }

      return programsDict;
    } catch (e) {
      console.error('[EPG] Parse error:', e);
      return {};
    }
  },

  /** Yield to the UI thread to keep the app responsive during heavy parsing */
  async yieldToUI() {
    return new Promise((resolve) => {
      // setTimeout(0) is a reliable way to yield in React Native
      setTimeout(resolve, 0);
    });
  },

  /**
   * Fast O(1) filter for programs using the pre-computed dictionary structure.
   * Prioritizes exact ID matches, then exact name matches, then fuzzy matching.
   * Includes Smart ID resolution for popular Indian providers.
   */
  getProgramsForChannel(programsDict, channel, resolvedId = null, tvgId = null) {
    if (!channel || !programsDict || Object.keys(programsDict).length === 0) return [];

    const targetResolvedId = (resolvedId || channel.iptvOrgId || '').toLowerCase();
    const targetTvgId = (tvgId || channel.tvgId || '').toLowerCase();

    // 1. O(1) Canonical iptv-org ID match
    if (targetResolvedId && programsDict[targetResolvedId]) {
       return programsDict[targetResolvedId];
    }

    // 2. O(1) Exact tvgId match
    if (targetTvgId && programsDict[targetTvgId]) {
       return programsDict[targetTvgId];
    }

    // 2.1 Smart Prefix Matching (Supporting Jio, TataPlay, SonyLiv, Zee5, SunNxt)
    if (targetTvgId) {
      // Try common prefixes if the M3U ID is just a numeric string or generic
      const prefixes = ['ts', 'sony', 'sun', '0-9-'];
      for (const pre of prefixes) {
        const prefixedId = `${pre}${targetTvgId}`;
        if (programsDict[prefixedId]) {
           return programsDict[prefixedId];
        }
      }
    }

    // 3. Fallback: Search for exact or fuzzy Name Match
    const targetNameClean = this.cleanName(channel.name);
    if (!targetNameClean) return [];

    let fuzzyMatch = null;

    // Scan unique channels in dict
    for (const [keyChannelId, pArr] of Object.entries(programsDict)) {
       if (pArr.length > 0) {
         const pNameClean = this.cleanName(pArr[0].channelName);
         
         // Priority 1: Exact Name Match
         if (pNameClean === targetNameClean) return pArr;
         
         // Priority 2: Fuzzy Match (Keep the first one found if no exact match is found)
         if (!fuzzyMatch && targetNameClean.length > 3) {
            if (pNameClean.includes(targetNameClean) || targetNameClean.includes(pNameClean)) {
               fuzzyMatch = pArr;
            }
         }
       }
    }

    return fuzzyMatch || [];
  },

  /** Format EPG timestamp "20240405120000 +0000" → user's localized "12:00" */
  formatEPGTime(timeStr) {
    if (typeof timeStr !== 'string' || timeStr.length < 12) return '';
    const ts = this.epgTimeToTimestamp(timeStr);
    if (!ts) return '';
    
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    } catch {
      return '';
    }
  },

  /**
   * Convert EPG timestamp to a Unix ms timestamp for live-now detection.
   * Handles "20240405120000 +0530" format including timezone offset.
   */
  epgTimeToTimestamp(timeStr) {
    if (typeof timeStr !== 'string' || timeStr.length < 14) return 0;
    try {
      const year = parseInt(timeStr.substring(0, 4), 10);
      const month = parseInt(timeStr.substring(4, 6), 10) - 1;
      const day = parseInt(timeStr.substring(6, 8), 10);
      const hour = parseInt(timeStr.substring(8, 10), 10);
      const min = parseInt(timeStr.substring(10, 12), 10);
      const sec = parseInt(timeStr.substring(12, 14), 10);

      // Parse optional timezone offset "+0530" or "-0500"
      const tzMatch = timeStr.match(/([+-])(\d{2})(\d{2})/);
      let utcOffsetMs = 0;
      if (tzMatch) {
        const sign = tzMatch[1] === '+' ? 1 : -1;
        const tzH = parseInt(tzMatch[2], 10);
        const tzM = parseInt(tzMatch[3], 10);
        utcOffsetMs = sign * (tzH * 60 + tzM) * 60 * 1000;
        
        // 1. If string has offset, treat input as the Offset time and subtract to get UTC
        const utcMs = Date.UTC(year, month, day, hour, min, sec) - utcOffsetMs;
        return utcMs;
      } else {
        // 2. No offset? Most XMLTV sources assume times are localized to the source server/country.
        // However, premium global feeds (like iptv-org) often use UTC.
        // We will default to local-ignorant Date constructor which assumes input is local to the device,
        // which is the safest "middle-ground" for general XMLTV files.
        const localDate = new Date(year, month, day, hour, min, sec);
        return localDate.getTime();
      }
    } catch {
      return 0;
    }
  },

  /**
   * High-level helper to get currently running and next upcoming show.
   * Optimized to use cache and avoid redundant processing.
   */
  async getNowAndNext(channel, countryCode = 'in') {
    if (!channel) return null;
    try {
      const programs = await this.fetchEPGForChannel(channel, countryCode);
      if (!programs || programs.length === 0) return null;

      const now = Date.now();
      const currentIndex = programs.findIndex(p => p.startTs <= now && p.stopTs > now);
      
      const current = currentIndex >= 0 ? programs[currentIndex] : null;
      const next = (currentIndex >= 0 && currentIndex < programs.length - 1) ? programs[currentIndex + 1] : null;

      // If no "current" found (e.g. gap in EPG), find the first one in the future
      if (!current) {
        const firstFuture = programs.find(p => p.startTs > now);
        return { now: null, next: firstFuture };
      }

      return { now: current, next };
    } catch (e) {
      return null;
    }
  },

  /**
   * Expose capability to manually clear the EPG cache from settings
   */
  clearCache() {
    epgCache.parsed.clear();
    epgCache.raw.clear();
    console.log('[EPG] Memory cache cleared successfully.');
  },

  /**
   * Bulk fetch EPG for multiple channels efficiently without spamming single-channel enrichments.
   * Leverages the existing cache mechanism.
   */
  async fetchBulkEPG(channels, countryCode = 'in') {
    if (!channels || channels.length === 0) return {};
    const { disableEpg } = usePlayerStore.getState();
    if (disableEpg) return {};

    const epgMap = {};
    
    // Process in smaller batches so we don't block the UI thread completely
    const batchSize = 20;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (channel) => {
        try {
          // Skip expensive enrichment for bulk grid fetching
          const programs = await this.fetchEPGForChannel(channel, countryCode, true);
          if (programs && programs.length > 0) {
            epgMap[channel.url] = programs;
          }
        } catch (e) {
          // Ignore individual channel failures
        }
      }));
      
      // Yield to UI thread
      await this.yieldToUI();
    }

    return epgMap;
  }
};
