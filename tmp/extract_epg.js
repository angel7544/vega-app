const fs = require('fs');
const path = require('path');

const xmlPath = 'd:/SteamLibrary/vega-app/src/epg/epg_1.xml';
const outputDir = 'd:/SteamLibrary/vega-app/src/epg-data';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`[EPG EXTRACT] Loading XML: ${xmlPath}...`);
const xml = fs.readFileSync(xmlPath, 'utf8');

// 1. Extract Channels
const channelMap = {};
const channelRegex = /<channel id="([^"]+)">\s*<display-name>(.*?)<\/display-name>/gs;
let match;
while ((match = channelRegex.exec(xml)) !== null) {
    channelMap[match[1]] = match[2].replace(/&amp;/g, '&');
}

console.log(`[EPG EXTRACT] Found ${Object.keys(channelMap).length} channels in XML.`);

// 2. Helper for Time Conversion
function parseXmlTime(timeStr) {
    // Format: 20260406183000 +0000
    const y = timeStr.slice(0, 4);
    const m = timeStr.slice(4, 6);
    const d = timeStr.slice(6, 8);
    const h = timeStr.slice(8, 10);
    const min = timeStr.slice(10, 12);
    const sec = timeStr.slice(12, 14);
    
    const date = new Date(Date.UTC(y, parseInt(m) - 1, d, h, min, sec));
    return {
        ts: date.getTime(),
        display: `${h}:${min}`
    };
}

// 3. Extract Programmes
const programmesByChannel = {};

// More flexible regex to find <programme> blocks
// Handles start, stop, channel, catchup-id etc in any order
const progBlockRegex = /<programme\s+([^>]+)>(.*?)<\/programme>/gs;
const attrRegex = /(\w+(?:-\w+)?)\s*=\s*"([^"]+)"/g;

console.log(`[EPG EXTRACT] Parsing programmes (this may take a few seconds)...`);
let pMatch;
let count = 0;

while ((pMatch = progBlockRegex.exec(xml)) !== null) {
    const rawAttrs = pMatch[1];
    const content = pMatch[2];
    
    // Extract attributes
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
    }

    if (!attrs.start || !attrs.stop || !attrs.channel) continue;

    const startObj = parseXmlTime(attrs.start);
    const stopObj = parseXmlTime(attrs.stop);
    const channelId = attrs.channel;

    // Extract title and description from content
    const titleMatch = /<title[^>]*>(.*?)<\/title>/s.exec(content);
    const descMatch = /<desc[^>]*>(.*?)<\/desc>/s.exec(content);
    
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').trim() : 'No Title';
    const desc = descMatch ? descMatch[1].replace(/&amp;/g, '&').trim() : '';
    const categoryMatch = /<category[^>]*>(.*?)<\/category>/s.exec(content);
    const category = categoryMatch ? categoryMatch[1].trim() : null;

    if (!programmesByChannel[channelId]) {
        programmesByChannel[channelId] = [];
    }

    programmesByChannel[channelId].push({
        channelId: channelId,
        channelName: channelMap[channelId] || channelId,
        start: startObj.display,
        stop: stopObj.display,
        startTs: startObj.ts,
        stopTs: stopObj.ts,
        title: title,
        desc: desc,
        category: category
    });
    count++;
}

console.log(`[EPG EXTRACT] Parsed ${count} program entries.`);

// 4. Helper for Filename Cleaning (Matches channelEPG.js logic)
function cleanFileName(name) {
    if (!name) return 'unknown';
    return name
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\s+(hd|sd|uhd|4k|1080p|720p|576p|fhd)\b/gi, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/__+/g, '_')
        .trim();
}

// 5. Write Individual Files
console.log(`[EPG EXTRACT] Writing files to ${outputDir}...`);

for (const [channelId, programs] of Object.entries(programmesByChannel)) {
    const displayName = channelMap[channelId] || channelId;
    const baseName = cleanFileName(displayName);
    const filename = `${baseName}_in.json`;
    const filePath = path.join(outputDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(programs, null, 2), 'utf8');
}

console.log(`[EPG EXTRACT] ✅ Done! Generated ${Object.keys(programmesByChannel).length} channel JSON files.`);
console.log(`[EPG EXTRACT] Your updated EPG data is ready in src/epg-data/`);
