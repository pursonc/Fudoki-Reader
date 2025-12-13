chrome.runtime.onInstalled.addListener(() => {
  // Context menu removed as per user request
});

// Offscreen document management
let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one 
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_PARSER'],
      justification: 'Parse Japanese text for Furigana injection',
    });
    await creating;
    creating = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_REQUEST') {
    (async () => {
      try {
        await setupOffscreenDocument('offscreen.html');
        const response = await chrome.runtime.sendMessage({
          type: 'ANALYZE_TEXT',
          text: request.text
        });
        sendResponse(response);
      } catch (error) {
        console.error('Analysis error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  } else if (request.type === 'TTS_SPEAK') {
    // Stop any current speech before starting new one
    chrome.tts.stop();
    
    chrome.tts.speak(request.text, {
      lang: 'ja-JP',
      rate: parseFloat(request.rate) || 1.0
    });
  } else if (request.type === 'TRANSLATE_TEXT') {
    (async () => {
      try {
        const targetLang = request.targetLang || 'zh-CN';
        const text = encodeURIComponent(request.text);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${targetLang}&dt=t&q=${text}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        // Parse result: [[["Translated Text", "Original", ...], ...], ...]
        if (data && data[0]) {
          const translatedText = data[0].map(item => item[0]).join('');
          sendResponse({ success: true, data: translatedText });
        } else {
          sendResponse({ success: false, error: 'No translation found' });
        }
      } catch (error) {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }
});

