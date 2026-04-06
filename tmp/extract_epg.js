const fs = require('fs');
const path = require('path');

const xmlPath = 'd:/SteamLibrary/vega-app/src/epg/epg-in.xml';
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
    channelMap[match[1]] = match[2];
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
const progRegex = /<programme start="([^"]+)" stop="([^"]+)" channel="([^"]+)">\s*<title lang="en">(.*?)<\/title>\s*<desc lang="en">(.*?)<\/desc>/gs;

console.log(`[EPG EXTRACT] Parsing programmes (this may take a few seconds)...`);
let pMatch;
let count = 0;
while ((pMatch = progRegex.exec(xml)) !== null) {
    const startObj = parseXmlTime(pMatch[1]);
    const stopObj = parseXmlTime(pMatch[2]);
    const channelId = pMatch[3];
    const title = pMatch[4].replace(/&amp;/g, '&');
    const desc = pMatch[5].replace(/&amp;/g, '&');

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
        category: null
    });
    count++;
}

console.log(`[EPG EXTRACT] Parsed ${count} program entries.`);

// 4. Write Individual Files
console.log(`[EPG EXTRACT] Writing files to ${outputDir}...`);

for (const [channelId, programs] of Object.entries(programmesByChannel)) {
    // Standardize filename: zeetv_in.json
    const base = channelId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `${base}_in.json`;
    const filePath = path.join(outputDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(programs, null, 2), 'utf8');
}

console.log(`[EPG EXTRACT] ✅ Done! Generated ${Object.keys(programmesByChannel).length} channel JSON files.`);
console.log(`[EPG EXTRACT] Your updated EPG data is ready in src/epg-data/`);
