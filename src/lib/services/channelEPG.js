import axios from 'axios';

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
    .replace(/&/g, 'and') // Map & to 'and' as seen in andtv_in.json
    .replace(/\s+(hd|sd|uhd|4k|1080p|720p|576p|fhd)\b/gi, '') // Strip tech suffixes (e.g., "Colors HD" -> "colors")
    .replace(/\((hd|sd|uhd|4k|1080p|720p|576p|fhd)\)/gi, '') // Strip bracketed tech suffixes (e.g., "(HD)")
    .split('(')[0] // Remove anything after brackets
    .replace(/^(in|us|uk|ca|au|fr|de|it|es|br|mx|ru|jp|cn|kr|ae|sa|za|tr|pk|bd|id|vn|th|my|ph|ng|eg|mx|ar|cl|co|pe|ve|eg|pl|nl|be|se|no|dk|fi|gr|pt|ro|ua|bg|hu|cz|sk|rs|hr|si|ee|lv|lt|is|ie|lu|mc|ad|li|mt|cy|il|jo|qa|kw|om|bh|af|lk|np|mm|kh|la|mn|kp|tw|hk|mo|sg|nz|fj|pg|vu|sb|tl|pw|fm|mh|ki|nr|ws|to|as|gu|mp|um|as|vi|pr|io|sh|fk|gs|gi|tc|ky|bm|ms|vg|ai|ax|aw|cw|sx|bq|pm|yt|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck|wf|tf|bv|hm|tf|aq|tk|nu|nf|pn|ck)\s*-\s*/gi, '') // Remove country prefixes
    .replace(/\b(hindi|english|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|bhojpuri|assamese|urdu)\b/gi, '') // Strip language tags
    .replace(/[^a-z0-9+]/g, ' ') // Keep numbers and '+'
    .replace(/\s+/g, ' ') // Collapse spaces
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
    console.log(`[EPG] Clean Name: "${clean}" (Orig: "${channel.name}")`);
    
    // Generate possible ID matches for the JSON filename
    const targetRId = (channel.iptvOrgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetTId = (channel.tvgId || '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const targetNId = clean.replace(/[^a-z0-9_-]/gi, '_');
    
    const suffixedNId = targetNId.endsWith(`_${countrySuffix}`) ? targetNId : `${targetNId}_${countrySuffix}`;
    const suffixedRId = targetRId && !targetRId.endsWith(`_${countrySuffix}`) ? `${targetRId}_${countrySuffix}` : targetRId;

    const possibleNames = [
        targetRId, 
        targetTId, 
        targetNId, 
        suffixedNId, 
        suffixedRId,
        targetNId.replace(/_/g, ''), // Fallback: zeecinema
        targetNId.replace(/_/g, '') + `_${countrySuffix}`, // Fallback: zeecinema_in
        clean.replace(/\s+/g, ''), // fallback: zeecinema
        clean.replace(/\s+/g, '') + `_${countrySuffix}`, // fallback: zeecinema_in
        clean.replace(/\s+/g, '_'), // fallback: zee_cinema
        clean.replace(/\s+/g, '_') + `_${countrySuffix}` // fallback: zee_cinema_in
    ].filter(Boolean);
    
    // Only unique names
    const uniqueNames = [...new Set(possibleNames)];

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
                return filterAndSlicePrograms(data);
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
