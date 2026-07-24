const FUDOKI_UNINSTALL_SURVEY_URL = 'https://YOUR_WORKER_DOMAIN/uninstall';

chrome.runtime.onInstalled.addListener((details) => {
  // Context menu removed as per user request
  updateUninstallSurveyUrl();
  if (details.reason === 'update') {
    const version = chrome.runtime.getManifest().version;
    chrome.storage.local.set({
      fudoki_update_notice: {
        version,
        previousVersion: details.previousVersion || ''
      }
    });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    chrome.action.setBadgeText({ text: 'NEW' });
  }
});

chrome.runtime.onStartup.addListener(() => {
  updateUninstallSurveyUrl();
});

function updateUninstallSurveyUrl() {
  if (FUDOKI_UNINSTALL_SURVEY_URL.includes('YOUR_WORKER_DOMAIN')) {
    return;
  }
  const manifest = chrome.runtime.getManifest();
  const params = new URLSearchParams({
    version: manifest.version || '',
    locale: chrome.i18n?.getUILanguage?.() || '',
    extension_id: chrome.runtime.id || ''
  });

  chrome.runtime.setUninstallURL(`${FUDOKI_UNINSTALL_SURVEY_URL}?${params.toString()}`);
}

// Offscreen document management
let creating; // A global promise to avoid concurrency issues
let analyzeQueue = Promise.resolve();

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
    try {
      creating = chrome.offscreen.createDocument({
        url: path,
        reasons: ['DOM_PARSER'],
        justification: 'Parse Japanese text for Furigana injection',
      });
      await creating;
    } finally {
      creating = null;
    }
  }
}

function enqueueAnalysis(text) {
  const job = analyzeQueue
    .catch(() => {})
    .then(() => analyzeText(text));
  analyzeQueue = job.catch(() => {});
  return job;
}

async function analyzeText(text) {
  await setupOffscreenDocument('offscreen.html');
  return sendOffscreenMessageWithTimeout({
    type: 'ANALYZE_TEXT',
    text
  }, 20000);
}

async function sendOffscreenMessageWithTimeout(message, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ success: false, error: 'Analysis timed out' });
    }, timeoutMs);
  });

  const response = chrome.runtime.sendMessage(message)
    .catch((error) => ({ success: false, error: error.message }));

  const result = await Promise.race([response, timeout]);
  clearTimeout(timeoutId);
  return result;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_REQUEST') {
    (async () => {
      try {
        const response = await enqueueAnalysis(request.text);
        sendResponse(response);
      } catch (error) {
        console.error('Analysis error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  } else if (request.type === 'TRANSLATE_TEXT') {
    (async () => {
      try {
        const targetLang = request.targetLang || 'zh-CN';
        const params = new URLSearchParams({
          client: 'gtx',
          sl: 'ja',
          tl: targetLang,
          dt: 't',
          q: request.text || ''
        });
        const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
        
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Translate HTTP ${res.status}`);
        }
        const data = await res.json();
        
        // Parse result: [[["Translated Text", "Original", ...], ...], ...]
        if (data && Array.isArray(data[0])) {
          const translatedText = data[0]
            .map(item => Array.isArray(item) ? item[0] : '')
            .filter(Boolean)
            .join('');
          if (!translatedText) {
            throw new Error('Empty translation');
          }
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
