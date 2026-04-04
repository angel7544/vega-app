export const sanitizeName = (name: string, keepQuality: boolean = false) => {
  if (!name) return '';
  
  const technicalTerms = [
    /\bWEB-DL\b/gi, /\bH264\b/gi, /\bx264\b/gi, /\bH265\b/gi, /\bx265\b/gi,
    /\b10bit\b/gi, /\bHEVC\b/gi, /\bBluray\b/gi, /\bAMZN\b/gi, /\bDSNP\b/gi, 
    /\bNF\b/gi, /\bATVP\b/gi, /\bSTUTTER\b/gi, /\bPROPER\b/gi, /\bREPACK\b/gi, 
    /\bREMUX\b/gi, /\bAVC\b/gi, /\[.*?\]/g, /\(.*?\)/g, /[-._]/g,
  ];

  const qualityLabels = [
    /\b1080p\b/gi, /\b720p\b/gi, /\b2160p\b/gi, /\b4k\b/gi, /\bUHD\b/gi, 
    /\bHDR\b/gi, /\bSDR\b/gi, /\bDV\b/gi,
  ];

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
