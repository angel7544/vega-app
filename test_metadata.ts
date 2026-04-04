import { extractMetadata } from './src/lib/utils';

const testTitles = [
  "Avatar.The.Way.Of.Water.2022.2160p.WEB-DL.DDP5.1.Atmos.H.265-CMRG",
  "The.Mandalorian.S03E01.REPACK.1080p.WEB.h264-KOGi",
  "Everything.Everywhere.All.At.Once.2022.4K.UHD.Bluray.x265.HDR.DV",
  "[Group] Movie Title (2023) [1080p] [HEVC]",
  "Show.Name.S01E05.720p.NF.WEB-DL.x264"
];

testTitles.forEach(title => {
  console.log(`Title: ${title}`);
  console.log('Extracted:', extractMetadata(title));
  console.log('---');
});
