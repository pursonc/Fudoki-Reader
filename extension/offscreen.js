// Offscreen document script for handling text analysis

let segmenter = null;

async function initSegmenter() {
  if (!segmenter) {
    segmenter = new JapaneseSegmenter();
    await segmenter.init();
  }
  return segmenter;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    handleAnalysis(message.text, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function handleAnalysis(text, sendResponse) {
  try {
    const seg = await initSegmenter();
    // Use segment() method which returns { lines: [...] }
    const result = await seg.segment(text);
    
    // Flatten lines to get a single array of tokens
    const tokens = result.lines.flat();
    
    // Convert tokens to a simpler format for the content script
    const processed = await Promise.all(tokens.map(async (token) => {
      const surface = token.surface; // segmenter.js returns 'surface'
      const reading = token.reading; // Katakana usually
      
      let hiragana = reading;
      let romaji = reading;

      // Helper function for manual Katakana -> Hiragana conversion
      const toHiragana = (str) => {
        if (!str) return str;
        return str.replace(/[\u30a1-\u30f6]/g, function(match) {
          var chr = match.charCodeAt(0) - 0x60;
          return String.fromCharCode(chr);
        });
      };

      // Use Kuroshiro instance from segmenter if available
      // Check if kuroshiro is initialized and has the convert method
      if (seg.kuroshiro && typeof seg.kuroshiro.convert === 'function') {
        try {
            // Check if reading contains Katakana
            if (/[\u30a0-\u30ff]/.test(reading)) {
                hiragana = await seg.kuroshiro.convert(reading, {to: 'hiragana'});
            }
            // Always try to convert to romaji
            romaji = await seg.kuroshiro.convert(reading, {to: 'romaji', mode: 'spaced', romajiSystem: 'hepburn'});
        } catch (e) {
            console.warn('Conversion failed for token:', reading, e);
            // Fallback if Kuroshiro fails
            hiragana = toHiragana(reading);
        }
      } else {
        // Fallback for Katakana -> Hiragana if Kuroshiro is missing
        hiragana = toHiragana(reading);
      }
      
      // Double check: if hiragana is still same as reading (and it is Katakana), force manual conversion
      // This handles cases where Kuroshiro might return the input unchanged on error/failure
      if (hiragana === reading && /[\u30a0-\u30ff]/.test(reading)) {
         hiragana = toHiragana(reading);
      }
      
      return {
        surface: surface,
        reading: reading, // Katakana
        hiragana: hiragana,
        romaji: romaji,
        pos: token.pos
      };
    }));

    sendResponse({ success: true, data: processed });
  } catch (error) {
    console.error('Analysis failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}
