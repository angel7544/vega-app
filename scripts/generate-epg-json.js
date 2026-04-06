const fs = require('fs');
const path = require('path');

const epgFile = path.join(__dirname, '../src/epg/epg-in.xml');
const outDir = path.join(__dirname, '../src/epg-data');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

console.log('Reading EPG file...');
const xmlText = fs.readFileSync(epgFile, 'utf8');
console.log(`Read ${xmlText.length} bytes.`);

const channelMap = {};
const programsDict = {};

console.log('Parsing channels...');
let cIdx = xmlText.indexOf('<channel ');
while (cIdx !== -1) {
    const endAttr = xmlText.indexOf('>', cIdx);
    const endC = xmlText.indexOf('</channel>', endAttr);
    if (endAttr === -1 || endC === -1) break;

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

function epgTimeToTimestamp(timeStr) {
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
}

function formatEPGTime(timeStr) {
    const ts = epgTimeToTimestamp(timeStr);
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
}

console.log('Parsing programmes...');
let pIdx = xmlText.indexOf('<programme ');
const now = Date.now();
while (pIdx !== -1) {
    const endAttr = xmlText.indexOf('>', pIdx);
    const endP = xmlText.indexOf('</programme>', endAttr);
    if (endAttr === -1 || endP === -1) break;

    const attrs = xmlText.substring(pIdx, endAttr);
    const channelId = (attrs.match(/channel="([^"]+)"/)?.[1] || '').toLowerCase();
    const rawStop = attrs.match(/stop="([^"]+)"/)?.[1] || '';
    const stopTs = epgTimeToTimestamp(rawStop);

    if (stopTs > now - 3600000) {
       const rawStart = attrs.match(/start="([^"]+)"/)?.[1] || '';
       const body = xmlText.substring(endAttr + 1, endP);
       const title = body.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.trim() || 'Untitled';
       const desc = body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1]?.trim().replace(/<[^>]+>/g, '') || '';
       const category = body.match(/<category[^>]*>([^<]+)<\/category>/)?.[1]?.trim() || null;

       const progObj = {
         channelId,
         channelName: channelMap[channelId] || '',
         start: formatEPGTime(rawStart),
         stop: formatEPGTime(rawStop),
         startTs: epgTimeToTimestamp(rawStart),
         stopTs,
         title,
         desc,
         category
       };

       if (!programsDict[channelId]) programsDict[channelId] = [];
       programsDict[channelId].push(progObj);
    }

    pIdx = xmlText.indexOf('<programme ', endP + 12);
}

console.log('Writing JSON files...');
let fileCount = 0;
for (const [chId, programs] of Object.entries(programsDict)) {
    // Sort and limit
    programs.sort((a, b) => a.startTs - b.startTs);
    // Safe filename
    const safeChannelId = chId.replace(/[^a-z0-9_-]/gi, '_');
    const outFile = path.join(outDir, `${safeChannelId}.json`);
    fs.writeFileSync(outFile, JSON.stringify(programs));
    fileCount++;
}

console.log(`✅ Successfully generated ${fileCount} JSON files in src/epg-data/`);
