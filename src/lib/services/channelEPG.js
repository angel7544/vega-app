import axios from 'axios';
import usePlayerStore, { DEFAULT_EPG_REPO } from '../zustand/playerStore';

const inflightRequests = {};
const epgCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes cache for direct channel lookups

const CHANNEL_ALIASES = {
  'adhyatm tv': 'adhyatam', 'adhytam': 'adhytam tv', 'adhytam ': 'adhytama',
  'apn news': 'apn',
  'b4 u musics': 'b4u music',
  'b4u musics': 'b4u music',
  'dd himachal pro': 'dd himachal',
  'sony marathi': 'sonymarathi',
  'sony sab': 'sonysab'
};

/**
 * Clean channel name for robust EPG matching.
 * Replicated from iptvParser for maximum independence.
 */
function cleanName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+(hd|sd|uhd|4k|1080p|720p|576p|fhd)\b/gi, '')
    .replace(/\((hd|sd|uhd|4k|1080p|720p|576p|fhd)\)/gi, '')
    .split('(')[0]
    .replace(/\b(hindi|english|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|bhojpuri|assamese|urdu)\b/gi, '')
    .replace(/[^a-z0-9+ ]/g, ' ') // Keep space for split later
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Provider-specific EPG ID formatting.
 * JiaTV: ID as is
 * TataPlay: ts(id)
 * Zee5: 0-9-(id)
 * SunNxt: sun(id)
 * SonyLiv: sony(id)
 */
function getProviderFormattedIds(rawId) {
    if (!rawId) return [];
    
    // Clean ID: remove any common prefixes first to avoid double prefixing
    const cleanId = rawId.toLowerCase().replace(/^(ts|sun|sony|0-9-)/, '');
    
    return [
        cleanId,               // JioTV / Raw
        `ts${cleanId}`,        // TataPlay
        `0-9-${cleanId}`,      // Zee5
        `sun${cleanId}`,       // SunNxt
        `sony${cleanId}`       // SonyLiv
    ];
}

/**
 * Fetch channel schedule (up to 15 items) directly from GitHub JSON repository.
 * Bypasses XML EPG guides for high-performance, screen-specific schedules.
 */
export async function fetchChannelSchedule(channel, countryCode = 'in', forceRefresh = false) {
    if (!channel || !channel.name) return [];

    const countrySuffix = countryCode.toLowerCase();
    const clean = cleanName(channel.name);
    console.log(`[EPG] Clean Name: "${clean}" (Orig: "${channel.name}")`);
    
    const targetRId = (channel.iptvOrgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetTId = (channel.tvgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetNId = clean.replace(/[^a-z0-9_-]/gi, '_');

    // Generate provider-specific variations for tvgId
    const providerIds = getProviderFormattedIds(channel.tvgId);

    const baseCandidates = [
        targetRId, 
        targetTId, 
        ...providerIds,
        targetNId,
        targetNId.replace(/_/g, ''), // zeecinema
        clean.replace(/\s+/g, ''), // zeecinema
        clean.replace(/\s+/g, '_'), // zee_cinema
        targetNId.replace(/[0-9]/g, '').replace(/__+/g, '_') // Strip numbers: zee_cinema
    ];

    // Priority 1: Check manual aliases
    if (CHANNEL_ALIASES[clean]) {
        baseCandidates.unshift(CHANNEL_ALIASES[clean]);
    }

    // Priority 3: Strip last word fallback (e.g. DD Himachal Pro -> dd_himachal)
    const words = clean.split(' ');
    if (words.length > 2) {
        const stripped = words.slice(0, -1).join('_');
        baseCandidates.push(stripped);
        baseCandidates.push(stripped.replace(/_/g, ''));
    }

    const filteredBase = [...new Set(baseCandidates)].filter(Boolean);

    const candidatesWithSuffix = [];
    filteredBase.forEach(b => {
        candidatesWithSuffix.push(b);
        if (!b.endsWith(`_${countrySuffix}`)) {
            candidatesWithSuffix.push(`${b}_${countrySuffix}`);
        }
        if (!b.endsWith(`${countrySuffix}`)) {
            candidatesWithSuffix.push(`${b}${countrySuffix}`);
        }
    });

    const uniqueNames = [...new Set(candidatesWithSuffix)];

    const repoUrl = (usePlayerStore.getState().epgRepoUrl || DEFAULT_EPG_REPO).replace(/\/$/, '');

    for (const pName of uniqueNames) {
        const shard = pName.charAt(0).toLowerCase();
        const jsonUrl = `${repoUrl}/${shard}/${pName}.json`;
        
        try {
            // Check cache
            const cached = epgCache.get(jsonUrl);
            if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
                if (cached.data === '404') continue;
                return filterAndSlicePrograms(cached.data);
            }

            if (forceRefresh) {
                console.log(`[EPG] 🔄 Force-refreshing: ${jsonUrl}`);
                epgCache.delete(jsonUrl);
            } else {
                console.log(`[EPG] 🌐 Fetching: ${jsonUrl}`);
            }

            // In-flight request management
            if (!inflightRequests[jsonUrl]) {
                inflightRequests[jsonUrl] = axios.get(jsonUrl, { 
                    timeout: 6000,
                    headers: {
                      'User-Agent': 'Mozilla/5.0'
                    }
                })
                    .then(res => res.data)
                    .catch(err => {
                        if (err.response?.status === 404) return '404';
                        throw err;
                    });
            }

            const data = await inflightRequests[jsonUrl];
            epgCache.set(jsonUrl, { data, timestamp: Date.now() });
            console.log(`[EPG] Status: "${data === '404' ? '404 NOT FOUND' : 'SUCCESS'}" for ${pName}`);
            
            // Cleanup inflight tracking
            setTimeout(() => delete inflightRequests[jsonUrl], 2000);

            if (data === '404' || typeof data === 'string') continue;

            if (Array.isArray(data) && data.length > 0) {
                const filtered = filterAndSlicePrograms(data);
                if (filtered.length > 0) {
                    return filtered;
                }
                console.log(`[EPG] ⚠️ Data found for ${pName} but all programs are outdated. Trying next...`);
            }
        } catch (e) {
            // Log for debugging but continue to next possible name
            console.warn(`[ChannelEPG] Failed to fetch from ${pName}:`, e.message);
        }
    }

    return [];
}

/**
 * Filter programs that haven't ended yet and slice to 15 items.
 */
function filterAndSlicePrograms(programs) {
    const now = Date.now();
    // Keep programs that end more than 30 minutes in the future (or are currently live)
    return programs
        .filter(p => (Number(p.stopTs) || 0) > now - 1800000)
        .slice(0, 15);
}
