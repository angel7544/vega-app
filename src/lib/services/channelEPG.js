import axios from 'axios';

import { iptvOrgApi } from './iptvOrgApi';

const inflightRequests = {};
const epgCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes cache for direct channel lookups

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
    .replace(/[^a-z0-9+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch channel schedule (up to 15 items) directly from GitHub JSON repository.
 * Bypasses XML EPG guides for high-performance, screen-specific schedules.
 */
export async function fetchChannelSchedule(channel, countryCode = 'in') {
    if (!channel || !channel.name) return [];

    const countrySuffix = countryCode.toLowerCase();
    const clean = cleanName(channel.name);
    
    // ─── API Matching ─────────────────────────────────────────────────────────
    // Before generating candidates, try to find a match in the iptv-org database
    let apiMatch = null;
    try {
        apiMatch = await iptvOrgApi.findChannel(channel.tvgId, channel.name, countryCode);
        if (apiMatch) {
            console.log(`[EPG] 🎯 API Match: "${apiMatch.id}" for "${channel.name}"`);
        }
    } catch (apiErr) {
        console.warn('[EPG] API lookup failed, falling back to heuristic matching:', apiErr.message);
    }

    const targetRId = (channel.iptvOrgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetTId = (channel.tvgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetNId = clean.replace(/[^a-z0-9_-]/gi, '_');

    const baseCandidates = [
        apiMatch?.id?.toLowerCase().replace(/\./g, '_'), // Canonical ID from API: zeetv_in
        ...(apiMatch?.alt_names || []).map(a => cleanName(a).replace(/[^a-z0-9_-]/gi, '_')), // Alt names from API
        targetRId, 
        targetTId, 
        targetNId,
        targetNId.replace(/_/g, ''), // zeecinema
        clean.replace(/\s+/g, ''), // zeecinema
        clean.replace(/\s+/g, '_'), // zee_cinema
        targetNId.replace(/[0-9]/g, '').replace(/__+/g, '_') // Strip numbers: zee_cinema
    ].filter(Boolean);

    const candidatesWithSuffix = [];
    baseCandidates.forEach(b => {
        candidatesWithSuffix.push(b);
        if (!b.endsWith(`_${countrySuffix}`)) {
            candidatesWithSuffix.push(`${b}_${countrySuffix}`);
        }
        if (!b.endsWith(`${countrySuffix}`)) {
            candidatesWithSuffix.push(`${b}${countrySuffix}`);
        }
    });

    const uniqueNames = [...new Set(candidatesWithSuffix)];

    for (const pName of uniqueNames) {
        const jsonUrl = `https://raw.githubusercontent.com/angel7544/vega-app/orbix-personal/src/epg-data/${pName}.json`;
        console.log(`[EPG] 🌐 Fetching: ${jsonUrl}`);
        
        try {
            // Check cache
            const cached = epgCache.get(jsonUrl);
            if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
                if (cached.data === '404') continue;
                return filterAndSlicePrograms(cached.data);
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
