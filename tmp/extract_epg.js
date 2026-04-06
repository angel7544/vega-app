const fs = require('fs');
const path = require('path');

const inputFiles = [
    
    'd:/SteamLibrary/vega-app/src/epg/epg-in.xml'
];
const outputDir = 'd:/SteamLibrary/vega-app/src/epg-data';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Clean channel name (Matches iptvParser and app lookup logic)
 */
function cleanChannelName(name) {
    if (!name) return 'unknown';
    return name
        .toLowerCase()
        // Remove country prefixes like "IN - "
        .replace(/^[a-z]{2}\s*-\s*/i, '')
        .replace(/&/g, 'and')
        .replace(/\s+(hd|sd|uhd|4k|1080p|720p|576p|fhd)\b/gi, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanFileName(name) {
    return cleanChannelName(name).replace(/\s+/g, '_');
}

function parseXmlTime(timeStr) {
    // Format: 20260404184500 +0000
    const y = timeStr.slice(0, 4);
    const m = timeStr.slice(4, 6);
    const d = timeStr.slice(6, 8);
    const h = timeStr.slice(8, 10);
    const min = timeStr.slice(10, 12);
    const sec = timeStr.slice(12, 14);
    
    // Use UTC for consistent timestamp generation
    const date = new Date(Date.UTC(y, parseInt(m) - 1, d, h, min, sec));
    return {
        ts: date.getTime(),
        display: `${h}:${min}`
    };
}

const programmesByCleanName = {};
const channelMap = {}; // Maps XML ID -> Display Name

// Regex setup
const channelRegex = /<channel id="([^"]+)">\s*<display-name>(.*?)<\/display-name>/gs;
const progBlockRegex = /<programme\s+([^>]+)>(.*?)<\/programme>/gs;
const attrRegex = /(\w+(?:-\w+)?)\s*=\s*"([^"]+)"/g;

for (const xmlPath of inputFiles) {
    if (!fs.existsSync(xmlPath)) {
        console.warn(`[EPG EXTRACT] ⚠️ File not found: ${xmlPath}`);
        continue;
    }

    console.log(`[EPG EXTRACT] 📄 Loading XML: ${xmlPath}...`);
    const xml = fs.readFileSync(xmlPath, 'utf8');

    // 1. Extract Channels
    let match;
    while ((match = channelRegex.exec(xml)) !== null) {
        channelMap[match[1]] = match[2].replace(/&amp;/g, '&');
    }

    console.log(`[EPG EXTRACT] Found ${Object.keys(channelMap).length} channels in ${path.basename(xmlPath)}.`);

    // 2. Extract Programmes
    console.log(`[EPG EXTRACT] ⏳ Parsing programmes...`);
    let pMatch;
    let countInFile = 0;

    while ((pMatch = progBlockRegex.exec(xml)) !== null) {
        const rawAttrs = pMatch[1];
        const content = pMatch[2];
        
        const attrs = {};
        let attrMatch;
        while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
            attrs[attrMatch[1]] = attrMatch[2];
        }

        if (!attrs.start || !attrs.stop || !attrs.channel) continue;

        const startObj = parseXmlTime(attrs.start);
        const stopObj = parseXmlTime(attrs.stop);
        const channelId = attrs.channel;
        const displayName = channelMap[channelId] || channelId;
        const cleanName = cleanChannelName(displayName);

        const titleMatch = /<title[^>]*>(.*?)<\/title>/s.exec(content);
        const descMatch = /<desc[^>]*>(.*?)<\/desc>/s.exec(content);
        
        const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').trim() : 'No Title';
        const desc = descMatch ? descMatch[1].replace(/&amp;/g, '&').trim() : '';

        if (!programmesByCleanName[cleanName]) {
            programmesByCleanName[cleanName] = [];
        }

        programmesByCleanName[cleanName].push({
            ...attrs, // Contains all XML attributes (start, stop, channel, etc.)
            channelId: channelId,
            channelName: displayName,
            start: startObj.display, // HH:mm format
            stop: stopObj.display,   // HH:mm format
            startTs: startObj.ts,     // millisecond timestamp
            stopTs: stopObj.ts,       // millisecond timestamp
            title: title,
            desc: desc
        });
        countInFile++;
    }
    console.log(`[EPG EXTRACT] Parsed ${countInFile} programs from ${path.basename(xmlPath)}.`);
}

// 3. Write Individual Merged Files
console.log(`[EPG EXTRACT] 💾 Writing files to ${outputDir}...`);

for (const [cleanName, programs] of Object.entries(programmesByCleanName)) {
    // Sort merged programs by start time
    programs.sort((a, b) => a.startTs - b.startTs);
    
    // Remove duplicates (same start time)
    const uniquePrograms = [];
    const seenStarts = new Set();
    for (const p of programs) {
        if (!seenStarts.has(p.startTs)) {
            uniquePrograms.push(p);
            seenStarts.add(p.startTs);
        }
    }

    const baseName = cleanName.replace(/\s+/g, '_');
    const filename = `${baseName}_in.json`;
    const filePath = path.join(outputDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(uniquePrograms, null, 2), 'utf8');
}

console.log(`[EPG EXTRACT] ✅ Done! Generated ${Object.keys(programmesByCleanName).length} channel JSON files.`);
console.log(`[EPG EXTRACT] Your updated EPG data is ready in src/epg-data/`);
