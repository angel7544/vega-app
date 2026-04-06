const fs = require('fs');
const path = require('path');

const XML_PATH = path.join(__dirname, '..', 'src', 'epg', 'epg-in.xml');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'epg-data');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function decodeHTMLEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function sanitizeFilename(id) {
  // Convert something like "ZeeTV.in" to "zeetv_in.json"
  // Previous files had "zeetv_in.json" and "zeetvin_in.json"
  // We'll standardize on lowercase and replace special chars.
  let name = id.toLowerCase();
  name = name.replace(/\./g, '_'); // ZeeTV.in -> zeetv_in
  name = name.replace(/\+/g, '_'); // ZeeTV+1.in -> zeetv_1_in
  name = name.replace(/[^a-z0-9_]/g, ''); // Safety strip
  return name + '.json';
}

console.log(`Reading EPG XML from: ${XML_PATH}`);
const xmlContent = fs.readFileSync(XML_PATH, 'utf-8');

// 1. Extract Channel Info Map
console.log('Building Channel Map...');
const channelMap = {};
const channelRegex = /<channel id="([^"]+)">\s*<display-name>([^<]+)<\/display-name>/g;
let match;
while ((match = channelRegex.exec(xmlContent)) !== null) {
  channelMap[match[1]] = decodeHTMLEntities(match[2].trim());
}
console.log(`Found ${Object.keys(channelMap).length} channels.`);

// 2. Group Programs by Channel
console.log('Grouping Programs...');
const programsByChannel = {};

// Using a more robust regex for programmes to handle multi-line tags
const programmeRegex = /<programme start="([^"]+)" stop="([^"]+)" channel="([^"]+)">([\s\S]*?)<\/programme>/g;
let progCount = 0;

while ((match = programmeRegex.exec(xmlContent)) !== null) {
  const [, start, stop, channelId, content] = match;
  
  if (!programsByChannel[channelId]) {
    programsByChannel[channelId] = [];
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(content);
  const descMatch = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(content);

  const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : 'No Title';
  const desc = descMatch ? decodeHTMLEntities(descMatch[1].trim()) : 'No Description';

  programsByChannel[channelId].push({
    start,
    stop,
    title,
    desc
  });
  
  progCount++;
  if (progCount % 1000 === 0) {
    process.stdout.write(`\rProcessed ${progCount} programs...`);
  }
}
console.log(`\nFinished grouping ${progCount} programs for ${Object.keys(programsByChannel).length} channels.`);

// 3. Write JSON files
console.log('Writing JSON files...');
let writeCount = 0;

for (const channelId in programsByChannel) {
  const programs = programsByChannel[channelId];
  const channelName = channelMap[channelId] || channelId;
  const filename = sanitizeFilename(channelId);
  const filePath = path.join(OUTPUT_DIR, filename);

  const jsonData = {
    channelId,
    channelName,
    programs: programs.sort((a, b) => a.start.localeCompare(b.start))
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    writeCount++;
  } catch (err) {
    console.error(`Error writing ${filename}: ${err.message}`);
  }
  
  if (writeCount % 50 === 0) {
     process.stdout.write(`\rSaved ${writeCount} files...`);
  }
}

console.log(`\nSuccessfully extracted data for ${writeCount} channels into ${OUTPUT_DIR}`);
console.log('EPG Data Extraction Complete.');
