export const technicalTerms = [
  /\bWEB-DL\b/gi, /\bH264\b/gi, /\bx264\b/gi, /\bH265\b/gi, /\bx265\b/gi,
  /\b10bit\b/gi, /\bHEVC\b/gi, /\bBluray\b/gi, /\bAMZN\b/gi, /\bDSNP\b/gi, 
  /\bNF\b/gi, /\bATVP\b/gi, /\bSTUTTER\b/gi, /\bPROPER\b/gi, /\bREPACK\b/gi, 
  /\bREMUX\b/gi, /\bAVC\b/gi, /\bEnglish\b/gi, /\bHindi\b/gi, /\bJapanese\b/gi, 
  /\bTamil\b/gi, /\bTelugu\b/gi, /\bMalayalam\b/gi, /\bKannada\b/gi, /\bSpanish\b/gi,  
  /\bMSub\b/gi, /\bMulti\b/gi, /\bDual\b/gi, /\bAudio\b/gi, /\bChinese\b/gi, 
  /\[.*?\]/g, /[{}]/g,  /\bMSUBS\b/gi, /\bESUSB\b/gi,
];

export const qualityLabels = [
  /\b1080p\b/gi, /\b720p\b/gi, /\b2160p\b/gi, /\b4k\b/gi, /\bUHD\b/gi, 
  /\bHDR\b/gi, /\bSDR\b/gi, /\bDV\b/gi,  /\b1440p\b/gi,
];

export const sanitizeName = (name: string, keepQuality: boolean = false) => {
  if (!name) return '';
  
  let sanitized = name;
  
  // Always remove technical junk
  technicalTerms.forEach(term => {
    sanitized = sanitized.replace(term, ' ');
  });

  // Only remove quality labels if keepQuality is false
  if (!keepQuality) {
    qualityLabels.forEach(term => {
      sanitized = sanitized.replace(term, ' ');
    });
  }

  return sanitized.replace(/\s+/g, ' ').trim() || name;
};

export const extractMetadata = (name: string) => {
  const technical: string[] = [];
  const quality: string[] = [];

  if (!name) return { technical, quality };

  technicalTerms.forEach(regex => {
    const matches = name.match(regex);
    if (matches) {
      matches.forEach(match => {
        // Clean match: remove brackets, dots, etc.
        let clean = match.replace(/[\[\]\(\)\-\._]/g, '').trim();
        if (clean && !technical.includes(clean.toUpperCase())) {
          technical.push(clean.toUpperCase());
        }
      });
    }
  });

  qualityLabels.forEach(regex => {
    const matches = name.match(regex);
    if (matches) {
      matches.forEach(match => {
        let clean = match.trim().toUpperCase();
        if (clean === 'DV') clean = 'DOLBY VISION';
        if (clean && !quality.includes(clean)) {
          quality.push(clean);
        }
      });
    }
  });

  return { technical, quality };
};
