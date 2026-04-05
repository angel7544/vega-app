const axios = require('axios');
const cheerio = require('cheerio');

async function testEPG() {
  try {
    const url = 'https://iptv-org.github.io/epg/guides/in.xml';
    console.log(`Fetching ${url}...`);
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data, { xmlMode: true });

    console.log('Channels found:', $('channel').length);
    
    // Sample first channel
    const firstChannel = $('channel').first();
    console.log('First Channel ID:', firstChannel.attr('id'));
    console.log('First Channel Name:', firstChannel.find('display-name').text());

    // Sample first programme for that channel
    const channelId = firstChannel.attr('id');
    const firstProgramme = $(`programme[channel="${channelId}"]`).first();
    console.log('First Programme Title:', firstProgramme.find('title').text());
    console.log('Starts at:', firstProgramme.attr('start'));
    console.log('Ends at:', firstProgramme.attr('stop'));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEPG();
