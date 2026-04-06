const fs = require('fs');
const path = require('path');

const epgDir = 'd:/SteamLibrary/vega-app/src/epg-data';
const files = fs.readdirSync(epgDir).filter(f => f.endsWith('.json'));

console.log(`[EPG FIXER] Found ${files.length} files to process.`);

files.forEach(file => {
    const filePath = path.join(epgDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!Array.isArray(data) || data.length === 0) return;
        
        const base = file.replace('_in.json', '').replace('.json', '');
        
        // Generate a clean name: e.g. "andtv" -> "&TV" or "b4umovies" -> "B4U Movies"
        let cleanName = base.toUpperCase();
        if (cleanName === 'ANDTV') cleanName = '&TV';
        else if (cleanName === 'ZEETV') cleanName = 'Zee TV';
        else if (cleanName === 'ZEECINEMA') cleanName = 'Zee Cinema';
        else if (cleanName === 'B4UMOVIES') cleanName = 'B4U Movies';
        // Add more special mappings or just use title case if needed
        else {
            cleanName = base.charAt(0).toUpperCase() + base.slice(1);
        }

        const channelId = base + '.in';

        data.forEach(p => {
            // Fix channelId and channelName
            p.channelId = channelId;
            if (!p.channelName || p.channelName.includes('&amp;')) {
                p.channelName = `in - ${cleanName}`;
            }
        });

        fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
        console.log(`[EPG FIXER] Fixed: ${file} (ID: ${channelId}, Name: ${cleanName})`);
    } catch (e) {
        console.error(`[EPG FIXER] Failed to process ${file}:`, e.message);
    }
});
