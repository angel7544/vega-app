import axios from 'axios';
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
  },
  
  getCacheKey(channel) {
    return channel.url;
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
      .replace(/\s*(hd|sd|uhd|4k|1080p|720p|576p|hindi|english|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|bhojpuri|assamese|urdu)\s*$/gi, '') // Remove trailing tech/lang info
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

        const nameParts = line.split(',');
        currentChannel.name = nameParts[nameParts.length - 1].trim();

        const nameUpper = currentChannel.name.toUpperCase();
        if (['4K', 'UHD', '2160'].some(k => nameUpper.includes(k))) currentChannel.quality = '4K';
        else if (['FHD', '1080', 'HEVC'].some(k => nameUpper.includes(k))) currentChannel.quality = 'FHD';
        else if (['HD', '720'].some(k => nameUpper.includes(k))) currentChannel.quality = 'HD';
        else currentChannel.quality = 'SD';
      } else if (line.startsWith('http') && currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
    return channels;
  },

  async fetchLocalEPG() {
     // No longer used. Kept for signature compatibility if any other piece of code calls it.
     return {};
  },

  async fetchEPGForChannel(channel, countryCode = 'in', skipEnrichment = false) {
    if (!channel || !channel.url) return [];
    const { disableEpg } = usePlayerStore.getState();
    if (disableEpg) return [];

    let resolvedId = channel.iptvOrgId || null;
    let resolvedTvgId = channel.tvgId || null;

    if (!resolvedId && !skipEnrichment) {
      try {
        const enriched = await iptvOrgApi.enrichChannel(channel.tvgId, channel.name, countryCode.toUpperCase(), channel.logo);
        resolvedId = enriched.iptvOrgId;
      } catch (e) {}
    }

    const clean = this.cleanName(channel.name);
    const countrySuffix = countryCode.toLowerCase();
    
    // Determine possible JSON file names based on IDs or name
    const targetRId = (resolvedId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetTId = (resolvedTvgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetNId = clean.replace(/[^a-z0-9_-]/gi, '_');
    
    // Also try with country suffix if not present
    const suffixedNId = targetNId.endsWith(`_${countrySuffix}`) ? targetNId : `${targetNId}_${countrySuffix}`;
    const suffixedRId = targetRId && !targetRId.endsWith(`_${countrySuffix}`) ? `${targetRId}_${countrySuffix}` : targetRId;

    // Step 1: Try JSON individual fetches from GitHub Repo (High Performance)
    const { epgRepoUrl } = usePlayerStore.getState();
    const jsonBase = epgRepoUrl || 'https://raw.githubusercontent.com/angel7544/vega-app/orbix-personal/src/epg-data';
    
    // Possible file names: tvg-id, iptv-org id, or cleaned name
    const candidates = Array.from(new Set([
      targetRId, targetTId, targetNId,
      suffixedRId, suffixedNId
    ])).filter(id => id && id.length > 1).map(id => `${jsonBase}/${id}.json`);

    if (candidates.length > 0) {
      try {
        const results = await Promise.all(candidates.map(async (url) => {
          try {
            const cached = epgCache.getParsed(url);
            if (cached) return cached;
            
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                 const parsed = data.map(p => ({
                    ...p,
                    startTs: p.startTs || new Date(p.start).getTime(),
                    stopTs: p.stopTs || new Date(p.stop).getTime(),
                 }));
                 epgCache.setParsed(url, parsed);
                 return parsed;
              }
            }
          } catch (e) {}
          return null;
        }));
        
        const validResult = results.find(r => r !== null);
        if (validResult) return validResult;
      } catch (e) {}
    }

    // Step 2: Fetch country XML (Original guide data fallback)
    const sources = [
      `https://iptv-org.github.io/epg/guides/${countryCode.toLowerCase()}.xml`,
      `https://epghub.pages.dev/${countryCode.toLowerCase()}.xml`,
    ];

    for (const source of sources) {
      try {
        let programsDict = epgCache.getParsed(source);
        if (!programsDict) {
           if (!inflightRequests[source]) {
               inflightRequests[source] = (async () => {
                    const response = await fetch(source);
                    if (!response.ok) return {};
                    const arrayBuffer = await response.arrayBuffer();
                    const finalData = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
                    if (finalData) {
                        const dict = await this.parseEPG(finalData);
                        epgCache.setParsed(source, dict);
                        return dict;
                    }
                    return {};
               })();
           }
           programsDict = await inflightRequests[source];
           setTimeout(() => delete inflightRequests[source], 5000);
        }

        const filtered = this.getProgramsForChannel(programsDict, channel, resolvedId, resolvedTvgId);
        if (filtered && filtered.length > 0) return filtered;
      } catch (error) {}
    }

    return [];
  },

  async parseEPG(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') return {};
    try {
      const channelMap = {};
      const programsDict = {};
      let yieldCounter = 0;
      const now = Date.now();

      // Parse channels
      let cIdx = xmlText.indexOf('<channel ');
      while (cIdx !== -1) {
        const endAttr = xmlText.indexOf('>', cIdx);
        const endC = xmlText.indexOf('</channel>', endAttr);
        if (endAttr === -1 || endC === -1) break;

        const body = xmlText.substring(endAttr + 1, endC);
        const idMatch = xmlText.substring(cIdx, endAttr).match(/id="([^"]+)"/);
        if (idMatch) {
          const dnMatch = body.match(/<display-name[^>]*>([^<]+)<\/display-name>/);
          if (dnMatch) channelMap[idMatch[1]] = dnMatch[1].trim().toLowerCase();
        }
        if (++yieldCounter % 50 === 0) await this.yieldToUI();
        cIdx = xmlText.indexOf('<channel ', endC + 10);
      }

      // Parse programmes
      let pIdx = xmlText.indexOf('<programme ');
      yieldCounter = 0;
      while (pIdx !== -1) {
        const endAttr = xmlText.indexOf('>', pIdx);
        const endP = xmlText.indexOf('</programme>', endAttr);
        if (endAttr === -1 || endP === -1) break;

        const attrs = xmlText.substring(pIdx, endAttr);
        const channelId = (attrs.match(/channel="([^"]+)"/)?.[1] || '').toLowerCase();
        const rawStop = attrs.match(/stop="([^"]+)"/)?.[1] || '';
        const stopTs = this.epgTimeToTimestamp(rawStop);

        // Memory Pruning: discard anything ended more than 1 hour ago
        if (stopTs < now - 3600000) {
           pIdx = xmlText.indexOf('<programme ', endP + 12);
           continue; 
        }

        const rawStart = attrs.match(/start="([^"]+)"/)?.[1] || '';
        const body = xmlText.substring(endAttr + 1, endP);
        const title = body.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.trim() || 'Untitled';
        
        const progObj = {
          channelId, channelName: channelMap[channelId] || '',
          start: this.formatEPGTime(rawStart), stop: this.formatEPGTime(rawStop),
          startTs: this.epgTimeToTimestamp(rawStart), stopTs,
          title, desc: body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1]?.trim().replace(/<[^>]+>/g, '') || '',
        };

        if (!programsDict[channelId]) programsDict[channelId] = [];
        programsDict[channelId].push(progObj);

        if (++yieldCounter % 100 === 0) await this.yieldToUI();
        pIdx = xmlText.indexOf('<programme ', endP + 12);
      }

      // Final sort and slice to cap memory
      for (const id in programsDict) {
        programsDict[id].sort((a, b) => a.startTs - b.startTs);
        if (programsDict[id].length > 6) programsDict[id] = programsDict[id].slice(0, 6);
      }

      return programsDict;
    } catch (e) {
      console.error('[EPG] Parse error:', e);
      return {};
    }
  },

  async yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  },

  getProgramsForChannel(programsDict, channel, resolvedId = null, tvgId = null) {
    if (!channel || !programsDict) return [];
    const now = Date.now();
    const targetRId = (resolvedId || channel.iptvOrgId || '').toLowerCase();
    const targetTId = (tvgId || channel.tvgId || '').toLowerCase();

    let pArr = programsDict[targetRId] || programsDict[targetTId];
    if (!pArr) {
       const clean = this.cleanName(channel.name);
       for (const arr of Object.values(programsDict)) {
          if (arr.length > 0 && this.cleanName(arr[0].channelName) === clean) {
             pArr = arr; break;
          }
       }
    }

    return pArr ? pArr.filter(p => p.stopTs > now).slice(0, 4) : [];
  },

  formatEPGTime(timeStr) {
    const ts = this.epgTimeToTimestamp(timeStr);
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  },

  epgTimeToTimestamp(timeStr) {
    if (!timeStr || timeStr.length < 14) return 0;
    try {
      const year = parseInt(timeStr.substring(0, 4), 10);
      const month = parseInt(timeStr.substring(4, 6), 10) - 1;
      const day = parseInt(timeStr.substring(6, 8), 10);
      const hour = parseInt(timeStr.substring(8, 10), 10);
      const min = parseInt(timeStr.substring(10, 12), 10);
      const sec = parseInt(timeStr.substring(12, 14), 10);
      const tzMatch = timeStr.match(/([+-])(\d{2})(\d{2})/);
      if (tzMatch) {
        const sign = tzMatch[1] === '+' ? 1 : -1;
        const offsetMs = sign * (parseInt(tzMatch[2], 10) * 60 + parseInt(tzMatch[3], 10)) * 60 * 1000;
        return Date.UTC(year, month, day, hour, min, sec) - offsetMs;
      }
      return new Date(year, month, day, hour, min, sec).getTime();
    } catch { return 0; }
  },

  async getNowAndNext(channel, countryCode = 'in') {
    const programs = await this.fetchEPGForChannel(channel, countryCode);
    if (!programs || programs.length === 0) return null;
    const now = Date.now();
    const idx = programs.findIndex(p => p.startTs <= now && p.stopTs > now);
    if (idx === -1) return { now: null, next: programs.find(p => p.startTs > now) || null };
    return { now: programs[idx], next: programs[idx+1] || null };
  },

  clearCache() {
    epgCache.parsed.clear();
    epgCache.raw.clear();
    console.log('[EPG] Memory cache cleared successfully.');
  },

  async fetchBulkEPG(channels, countryCode = 'in') {
    if (!channels || channels.length === 0) return {};
    const epgMap = {};
    const batchSize = 3; // Reduced batch size for stability
    
    // Prioritize channels that are NOT currently in cache
    const needed = channels.filter(c => !epgCache.parsed.has(epgCache.getCacheKey(c)));
    
    for (let i = 0; i < needed.length; i += batchSize) {
      const batch = needed.slice(i, i + batchSize);
      await Promise.all(batch.map(async (c) => {
        try {
          const p = await this.fetchEPGForChannel(c, countryCode, true);
          if (Array.isArray(p) && p.length > 0) {
             epgMap[c.url] = p;
             epgCache.setParsed(c.url, p);
          }
        } catch (e) {}
      }));
      if (i + batchSize < needed.length) {
         await new Promise(r => setTimeout(r, 150)); // Slightly longer pause between batches to avoid UI jank
         await this.yieldToUI();
      }
    }
    
    return { ...epgMap };
  },

  // Helper for consistent cache keys
  getCacheKey(channel) {
    return channel.url;
  }
};
