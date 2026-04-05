import axios from 'axios';
import { iptvOrgApi } from './services/iptvOrgApi';
import usePlayerStore from './zustand/playerStore';

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
      .replace(/\s*(hd|sd|uhd|4k|1080p|720p|576p|hindi|english|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|bhojpuri|assamese|urdu)\s*$/gi, '') // Remove trailing tech/lang info
      .replace(/[^a-z0-9]/g, '') // Remove special characters
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
   * Fetch EPG schedule for a channel using the iptv-org API for ID resolution,
   * then download the country XML for program data.
   *
   * @param {object} channel - { tvgId, name, logo, category, url }
   * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. 'in', 'us')
   * @returns {Promise<Program[]>}
   */
  async fetchEPGForChannel(channel, countryCode = 'in') {
    if (!channel) return [];

    const { disableEpg } = usePlayerStore.getState();
    if (disableEpg) {
      console.log('[EPG] EPG is disabled in settings, skipping fetch.');
      return [];
    }

    // Step 1: Resolve canonical channel ID via iptv-org API
    let resolvedId = channel.iptvOrgId || null;
    let resolvedTvgId = channel.tvgId || null;

    if (!resolvedId) {
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
      // Strip .gz to prevent binary parsing freezes
      const safeCustomUrl = customEpgUrl.endsWith('.gz') ? customEpgUrl.slice(0, -3) : customEpgUrl;
      sources.unshift(safeCustomUrl);
    }

    for (const source of sources) {
      try {
        if (source.endsWith('.gz')) {
           console.warn(`[EPG] Skipping ${source} to prevent binary parsing thread freeze. Requesting .xml version directly.`);
           continue;
        }

        console.log(`📡 Fetching EPG XML: ${source}`);
        const response = await axios.get(source, { timeout: 15000 });
        
        // Critical safety check against fetching raw GZIP without proper encoding headers
        if (typeof response.data === 'string' && response.data.length > 2) {
          if (response.data.charCodeAt(0) === 0x1f || response.data.charCodeAt(0) === 31 || response.headers['content-type'] === 'application/gzip') {
            console.warn(`[EPG] Binary GZIP payload detected from ${source}. Skipping to prevent crash.`);
            continue;
          }
        }

        if (response.data) {
          
          // Optimization: create a checker function to skip parsing programs for unrelated channels
          const targetTvgIdLower = (channel.tvgId || '').toLowerCase();
          const targetNameClean = this.cleanName(channel.name);
          const targetResolvedIdLower = (resolvedId || '').toLowerCase();

          const matchChecker = (pIdRaw, pNameRaw) => {
             const pId = (pIdRaw || '').toLowerCase();
             const pNameClean = this.cleanName(pNameRaw);
             
             if (targetResolvedIdLower && pId === targetResolvedIdLower) return true;
             if (targetTvgIdLower && pId === targetTvgIdLower) return true;
             
             if (targetNameClean) {
                // Tier 1: Exact normalized name match
                if (pNameClean === targetNameClean) return true;
                
                // Tier 2: Suffix/Prefix match, but only for strings longer than 3 chars
                if (targetNameClean.length > 3) {
                  if (pNameClean.includes(targetNameClean) || targetNameClean.includes(pNameClean)) return true;
                }
             }
             return false;
          };

          const allPrograms = this.parseEPG(response.data, matchChecker);
          const filtered = this.getProgramsForChannel(
            allPrograms,
            channel,
            resolvedId,
            resolvedTvgId,
          );
          if (filtered.length > 0) {
            console.log(
              `[EPG] Found ${filtered.length} programs for "${channel.name}" from ${source}`,
            );
            return filtered;
          }
        }
      } catch (error) {
        console.warn(`⚠️ EPG source failed: ${source}`);
      }
    }

    return [];
  },

  /**
   * Parse EPG XML using a lightweight regex-based approach (no cheerio dependency).
   * Returns a flat array of program objects.
   * 
   * @param {string} xmlText
   * @param {function} matchChecker - Optional function to filter channel IDs before running expensive regex
   */
  parseEPG(xmlText, matchChecker = null) {
    if (!xmlText || typeof xmlText !== 'string') return [];
    try {
      const channelMap = {};
      const programs = [];

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
        cIdx = xmlText.indexOf('<channel ', endC + 10);
      }

      // High-performance substring parsing for programmes
      let pIdx = xmlText.indexOf('<programme ');
      while (pIdx !== -1) {
        const endAttr = xmlText.indexOf('>', pIdx);
        if (endAttr === -1) break;
        const endP = xmlText.indexOf('</programme>', endAttr);
        if (endP === -1) break;

        const attrs = xmlText.substring(pIdx + 11, endAttr);
        
        const channelAttr = attrs.match(/channel="([^"]+)"/);
        const channelId = channelAttr?.[1] || '';
        const channelName = channelMap[channelId] || '';

        // Optimization: skip expensive regex parsing if condition fails
        if (matchChecker && !matchChecker(channelId, channelName)) {
           pIdx = xmlText.indexOf('<programme ', endP + 12);
           continue;
        }

        const body = xmlText.substring(endAttr + 1, endP);

        const startAttr = attrs.match(/start="([^"]+)"/);
        const stopAttr = attrs.match(/stop="([^"]+)"/);

        const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/);
        const descMatch = body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
        const iconMatch = body.match(/<icon\s+src="([^"]+)"/);
        const categoryMatch = body.match(/<category[^>]*>([^<]+)<\/category>/);

        const rawStart = startAttr?.[1] || '';
        const rawStop = stopAttr?.[1] || '';

        programs.push({
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
        });

        pIdx = xmlText.indexOf('<programme ', endP + 12);
      }

      return programs;
    } catch (e) {
      console.error('[EPG] Parse error:', e);
      return [];
    }
  },

  /**
   * Filter programs for a specific channel using canonical ID (most reliable),
   * tvgId, or fuzzy name matching as fallbacks.
   */
  getProgramsForChannel(allPrograms, channel, resolvedId = null, tvgId = null) {
    if (!channel || !allPrograms?.length) return [];

    const targetTvgId = (tvgId || channel.tvgId || '').toLowerCase();
    const targetNameClean = this.cleanName(channel.name);
    const targetResolvedId = (resolvedId || channel.iptvOrgId || '').toLowerCase();

    return allPrograms.filter(p => {
      const pId = (p.channelId || '').toLowerCase();
      
      // 1. Canonical iptv-org ID match (most reliable)
      if (targetResolvedId && pId === targetResolvedId) return true;

      // 2. Exact tvgId match
      if (targetTvgId && pId === targetTvgId) return true;

      // 3. Normalized name tiered match
      const pNameClean = this.cleanName(p.channelName);

      if (targetNameClean) {
        // High confidence: Exact match
        if (pNameClean === targetNameClean) return true;
        
        // Medium confidence: Word-level match for names > 3 chars
        if (targetNameClean.length > 3) {
           if (pNameClean.includes(targetNameClean) || targetNameClean.includes(pNameClean)) return true;
        }
      }

      return false;
    });
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
};
