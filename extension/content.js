// Fudoki Content Script

let currentPopup = null;
let iconBtn = null;
let lastTokens = null;
let lastText = null;
let settings = {
  fudoki_enabled: true,
  fudoki_reading_mode: 'hiragana',
  fudoki_show_romaji: false,
  fudoki_show_pos: false,
  fudoki_translate_target: 'zh-CN',
  fudoki_theme: 'system',
  fudoki_tts_speed: 1.0
};

// Initialize settings
chrome.storage.local.get(['fudoki_enabled', 'fudoki_reading_mode', 'fudoki_show_romaji', 'fudoki_show_pos', 'fudoki_translate_target', 'fudoki_theme', 'fudoki_tts_speed'], (result) => {
  settings = { ...settings, ...result };
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_SETTINGS') {
    if (message.settings) {
      settings = { ...settings, ...message.settings };
    } else if (typeof message.enabled !== 'undefined') {
      settings.fudoki_enabled = message.enabled;
    }
    
    // Live update if popup is open
    if (currentPopup && lastTokens && lastText) {
      renderResult(lastTokens, lastText);
    }
  }
});

document.addEventListener('mouseup', (event) => {
  // Re-read settings from storage to ensure we have the latest state
  // This handles cases where the popup updated storage but the message wasn't received
  chrome.storage.local.get(['fudoki_enabled', 'fudoki_reading_mode', 'fudoki_show_romaji', 'fudoki_show_pos', 'fudoki_translate_target', 'fudoki_theme', 'fudoki_tts_speed'], (result) => {
    settings = { ...settings, ...result };
    
    if (!settings.fudoki_enabled) return;
    
    // Delay slightly to ensure selection is finalized
    setTimeout(() => {
      handleSelection(event);
    }, 10);
  });
});

// Close popup when clicking outside
document.addEventListener('mousedown', (event) => {
  if (currentPopup && !currentPopup.contains(event.target) && (!iconBtn || !iconBtn.contains(event.target))) {
    removePopup();
  }
});

function removePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (iconBtn) {
    iconBtn.remove();
    iconBtn = null;
  }
}

function handleSelection(event) {
  // If click is inside popup, ignore immediately
  if (currentPopup && event && currentPopup.contains(event.target)) {
    return;
  }

  const selection = window.getSelection();
  const text = selection.toString().trim();

  // Ignore empty or non-Japanese text (simple heuristic)
  if (!text || !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return;
  }
  
  // Don't show if selection anchor is inside our own popup (double check)
  if (currentPopup && currentPopup.contains(selection.anchorNode)) {
    return;
  }

  // Remove existing popup
  removePopup();

  // Show popup immediately
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  showPopup(text, window.scrollX + rect.left, window.scrollY + rect.bottom + 10);
}

// Removed showIcon function as we now show popup directly


async function showPopup(text, x, y) {
  removePopup();

  currentPopup = document.createElement('div');
  currentPopup.className = 'fudoki-popup';
  
  // Prevent events from bubbling up to document, which would trigger handleSelection
  // and potentially re-render the popup if DOM elements are modified (like button icons)
  currentPopup.addEventListener('mouseup', (e) => e.stopPropagation());
  currentPopup.addEventListener('mousedown', (e) => e.stopPropagation());
  currentPopup.addEventListener('click', (e) => e.stopPropagation());
  
  // Apply theme
  if (settings.fudoki_theme === 'dark') {
    currentPopup.classList.add('fudoki-theme-dark');
  } else if (settings.fudoki_theme === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      currentPopup.classList.add('fudoki-theme-dark');
    }
  }

  currentPopup.style.left = `${x}px`;
  currentPopup.style.top = `${y}px`;
  
  // Loading state
  currentPopup.innerHTML = `
    <div class="fudoki-loading">
      <div class="fudoki-spinner"></div>
      <span>Analyzing...</span>
    </div>
  `;
  
  document.body.appendChild(currentPopup);
  
  // Adjust position if off-screen
  const rect = currentPopup.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    currentPopup.style.left = `${window.innerWidth - rect.width - 10}px`;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_REQUEST',
      text: text
    });

    if (response && response.success) {
      renderResult(response.data, text);
    } else {
      currentPopup.innerHTML = `<div style="color:red;padding:10px;">Error: ${response?.error || 'Unknown error'}</div>`;
    }
  } catch (e) {
    currentPopup.innerHTML = `<div style="color:red;padding:10px;">Error: ${e.message}</div>`;
  }
}

function renderResult(tokens, originalText) {
  if (!currentPopup) return;
  
  lastTokens = tokens;
  lastText = originalText;
  
  let html = '<div class="fudoki-content">';
  
  tokens.forEach(token => {
    if (token.surface === '\n') {
      html += '<div class="fudoki-break"></div>';
      return;
    }

    // Determine reading to show
    let reading = '';
    if (settings.fudoki_reading_mode === 'hiragana') {
      reading = token.hiragana || token.reading || '';
    } else if (settings.fudoki_reading_mode === 'katakana') {
      reading = token.reading || '';
    } else if (settings.fudoki_reading_mode === 'romaji') {
      reading = token.romaji || '';
    }

    // Only show reading if surface contains Kanji (or if mode is Romaji)
    // This prevents annotating Hiragana/Katakana words with themselves
    const hasKanji = /[\u4e00-\u9faf]/.test(token.surface);
    if (!hasKanji && settings.fudoki_reading_mode !== 'romaji') {
      reading = '';
    }

    // Map POS to short label and color class
    let posLabel = '';
    let posClass = '';
    if (settings.fudoki_show_pos && token.pos && token.pos[0]) {
      const pos = token.pos[0];
      if (pos === '名詞') { posLabel = '名'; posClass = 'pos-noun'; }
      else if (pos === '動詞') { posLabel = '動'; posClass = 'pos-verb'; }
      else if (pos === '形容詞') { posLabel = '形'; posClass = 'pos-adj'; }
      else if (pos === '副詞') { posLabel = '副'; posClass = 'pos-adv'; }
      else if (pos === '助詞') { posLabel = '助'; posClass = 'pos-particle'; }
      else if (pos === '助動詞') { posLabel = '助動'; posClass = 'pos-aux'; }
      else if (pos === '接続詞') { posLabel = '接'; posClass = 'pos-conj'; }
      else if (pos === '連体詞') { posLabel = '連'; posClass = 'pos-adn'; }
      else if (pos === '感動詞') { posLabel = '感'; posClass = 'pos-int'; }
      else { posLabel = '&nbsp;'; } // Use non-breaking space to preserve height
    }

    html += `
      <div class="fudoki-token">
        ${reading ? `<div class="fudoki-reading">${reading}</div>` : '<div class="fudoki-reading empty"></div>'}
        ${settings.fudoki_show_romaji ? `<div class="fudoki-romaji">${token.romaji || ''}</div>` : ''}
        <div class="fudoki-surface">${token.surface}</div>
        ${settings.fudoki_show_pos ? `
          <div class="fudoki-pos-bar ${posClass}"></div>
          <div class="fudoki-pos-label">${posLabel}</div>
        ` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  
  // Actions
  const showTranslate = settings.fudoki_translate_target && settings.fudoki_translate_target !== 'none';
  
  html += `
    <div class="fudoki-translation" id="fudoki-translation-result" style="display:none;"></div>
    <div class="fudoki-popup-actions">
      <button class="fudoki-btn" id="fudoki-vocab-btn" title="Add to Vocabulary">
        <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
      </button>
      ${showTranslate ? `
      <button class="fudoki-btn" id="fudoki-translate-btn" title="Translate">
        <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      </button>
      ` : ''}
      <div style="width: 1px; height: 24px; background: var(--fudoki-border); margin: 0 4px;"></div>
      <button class="fudoki-btn" id="fudoki-prev-btn" title="Previous Word">
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-play-btn" title="Play">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-next-btn" title="Next Word">
        <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-restart-btn" title="Restart" style="display:none;">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </button>
    </div>
  `;
  
  currentPopup.innerHTML = html;
  
  const vocabBtn = currentPopup.querySelector('#fudoki-vocab-btn');
  // Store the original icon SVG to ensure we can restore it reliably
  const vocabIconSvg = vocabBtn.innerHTML;

  vocabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Construct reading from tokens for simple display/sorting
    const reading = tokens.map(t => {
      if (settings.fudoki_reading_mode === 'hiragana') return t.hiragana || t.reading || t.surface;
      if (settings.fudoki_reading_mode === 'katakana') return t.reading || t.surface;
      if (settings.fudoki_reading_mode === 'romaji') return t.romaji || t.surface;
      return t.reading || t.surface;
    }).join('');

    // Get translation if available
    const translationEl = currentPopup.querySelector('#fudoki-translation-result');
    const translation = (translationEl && translationEl.style.display !== 'none') ? translationEl.textContent : '';

    const data = {
      word: originalText,
      reading: reading,
      context: originalText,
      tokens: tokens,
      translation: translation
    };

    addToVocabulary(data, vocabBtn, vocabIconSvg);
  });

  const playBtn = currentPopup.querySelector('#fudoki-play-btn');
  const restartBtn = currentPopup.querySelector('#fudoki-restart-btn');
  const prevBtn = currentPopup.querySelector('#fudoki-prev-btn');
  const nextBtn = currentPopup.querySelector('#fudoki-next-btn');
  
  const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  // Pre-calculate token boundaries for highlighting
  let currentLength = 0;
  const tokenBoundaries = tokens.map(t => {
    const start = currentLength;
    currentLength += t.surface.length;
    return { start, end: currentLength };
  });

  let currentTokenIndex = 0;
  let isStepping = false;

  const updateHighlight = (charIndex) => {
    const tokenEls = currentPopup.querySelectorAll('.fudoki-token');
    tokenEls.forEach(el => el.classList.remove('fudoki-highlight'));
    
    if (charIndex === null) return;

    // Find token containing charIndex
    // If we are playing partial text, charIndex is relative to start of partial text
    // But here we expect absolute charIndex if we manage it correctly
    
    const tokenIndex = tokenBoundaries.findIndex(b => charIndex >= b.start && charIndex < b.end);
    if (tokenIndex !== -1 && tokenEls[tokenIndex]) {
      tokenEls[tokenIndex].classList.add('fudoki-highlight');
      currentTokenIndex = tokenIndex;
    }
  };
  
  const highlightToken = (index) => {
    const tokenEls = currentPopup.querySelectorAll('.fudoki-token');
    tokenEls.forEach(el => el.classList.remove('fudoki-highlight'));
    if (tokenEls[index]) {
      tokenEls[index].classList.add('fudoki-highlight');
    }
  };

  const onStart = () => {
    playBtn.innerHTML = pauseIcon;
    playBtn.title = "Pause";
    restartBtn.style.display = 'flex';
  };

  const onEnd = () => {
    playBtn.innerHTML = playIcon;
    playBtn.title = "Play";
    if (!isStepping) {
      restartBtn.style.display = 'none';
      updateHighlight(null);
      currentTokenIndex = 0;
    } else {
      // If stepping, keep highlight on current token
      // But reset play button
    }
    isStepping = false;
  };

  const onBoundary = (event) => {
    if (event.name === 'word') {
      // If playing full text, event.charIndex is absolute
      // If playing partial, we need offset
      // But SpeechController.play is generic.
      // Let's handle offset in the caller if needed.
      // For now, assume full text playback for "Play" button
      updateHighlight(event.charIndex);
    }
  };

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rate = parseFloat(settings.fudoki_tts_speed) || 1.0;
    
    // If we are at the end, restart
    if (currentTokenIndex >= tokens.length - 1 && !SpeechController.isPlaying) {
      currentTokenIndex = 0;
    }

    // Calculate text to speak from current position
    // We need to map currentTokenIndex to char index
    const startCharIndex = tokenBoundaries[currentTokenIndex].start;
    const textToSpeak = originalText.substring(startCharIndex);
    
    const onBoundaryWithOffset = (event) => {
      if (event.name === 'word') {
        updateHighlight(event.charIndex + startCharIndex);
      }
    };

    const state = SpeechController.toggle(
      textToSpeak, 
      rate, 
      onStart, 
      onEnd, 
      onBoundaryWithOffset
    );

    if (state === 'paused') {
      playBtn.innerHTML = playIcon;
      playBtn.title = "Resume";
    } else if (state === 'resumed') {
      playBtn.innerHTML = pauseIcon;
      playBtn.title = "Pause";
    }
  });

  restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rate = parseFloat(settings.fudoki_tts_speed) || 1.0;
    currentTokenIndex = 0;
    SpeechController.play(originalText, rate, onStart, onEnd, onBoundary);
  });
  
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTokenIndex > 0) {
      currentTokenIndex--;
      playSingleToken(currentTokenIndex);
    }
  });
  
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentTokenIndex < tokens.length - 1) {
      currentTokenIndex++;
      playSingleToken(currentTokenIndex);
    }
  });
  
  const playSingleToken = (index) => {
    isStepping = true;
    const token = tokens[index];
    const rate = parseFloat(settings.fudoki_tts_speed) || 1.0;
    
    highlightToken(index);
    
    // Update UI to show playing state (optional, maybe just highlight is enough)
    // playBtn.innerHTML = pauseIcon; 
    
    SpeechController.play(
      token.surface, 
      rate, 
      () => { /* onStart */ }, 
      () => { 
        /* onEnd */ 
        // Keep highlight
        playBtn.innerHTML = playIcon;
        playBtn.title = "Play";
        // Don't hide restart button if we are in middle of text?
        restartBtn.style.display = 'flex';
      }, 
      null // No boundary needed for single word
    );
  };

  if (showTranslate) {
    const translateBtn = currentPopup.querySelector('#fudoki-translate-btn');
    const translationResult = currentPopup.querySelector('#fudoki-translation-result');
    
    translateBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent bubbling
      translateBtn.disabled = true;
      // Keep icon, maybe add spinning class
      translateBtn.classList.add('loading');
      
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          text: originalText,
          targetLang: settings.fudoki_translate_target
        });
        
        if (response && response.success) {
          translationResult.textContent = response.data;
          translationResult.style.display = 'block';
        } else {
          translationResult.textContent = 'Translation failed.';
          translationResult.style.display = 'block';
        }
      } catch (e) {
        translationResult.textContent = 'Error: ' + e.message;
        translationResult.style.display = 'block';
      } finally {
        translateBtn.disabled = false;
        translateBtn.classList.remove('loading');
      }
    });
  }
}

// TTS Helper Functions
function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  // Priority 1: Exact match for "Kyoko" (user preference in screenshot)
  let voice = voices.find(v => v.name.includes('Kyoko'));
  
  // Priority 2: Any Japanese voice
  if (!voice) {
    voice = voices.find(v => v.lang.toLowerCase().startsWith('ja'));
  }
  
  return voice;
}

const SpeechController = {
  utterance: null,
  isPaused: false,
  isPlaying: false,
  
  play(text, rate, onStart, onEnd, onBoundary) {
    this.stop(); // Stop previous
    
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = 'ja-JP';
    this.utterance.rate = rate;
    
    const voice = getJapaneseVoice();
    if (voice) this.utterance.voice = voice;
    
    this.utterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      if (onStart) onStart();
    };
    
    this.utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      if (onEnd) onEnd();
    };
    
    this.utterance.onboundary = (event) => {
      if (onBoundary) onBoundary(event);
    };

    this.utterance.onerror = (e) => {
        console.error("TTS Error", e);
        this.isPlaying = false;
        this.isPaused = false;
        if (onEnd) onEnd();
    }
    
    window.speechSynthesis.speak(this.utterance);
  },
  
  pause() {
    if (this.isPlaying && !this.isPaused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  },
  
  resume() {
    if (this.isPlaying && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  },
  
  stop() {
    window.speechSynthesis.cancel();
    this.isPlaying = false;
    this.isPaused = false;
  },
  
  toggle(text, rate, onStart, onEnd, onBoundary) {
    if (this.isPlaying) {
      if (this.isPaused) {
        this.resume();
        return 'resumed';
      } else {
        this.pause();
        return 'paused';
      }
    } else {
      this.play(text, rate, onStart, onEnd, onBoundary);
      return 'started';
    }
  }
};

function addToVocabulary(data, btnElement, originalIcon) {
  chrome.storage.local.get(['fudoki_vocabulary', 'fudoki_language'], (result) => {
    const vocabulary = result.fudoki_vocabulary || [];
    const lang = result.fudoki_language || 'en';
    
    const messages = {
      en: { existed: 'Existed', added: 'Added' },
      zh: { existed: '已存在', added: '已添加' },
      ja: { existed: '登録済', added: '追加済' }
    };
    
    const msg = messages[lang] || messages.en;

    // Check for duplicates
    if (vocabulary.some(item => item.word === data.word)) {
      // Visual feedback for duplicate
      btnElement.innerHTML = `<span style="font-size:12px; white-space:nowrap; font-weight:bold;">${msg.existed}</span>`;
      btnElement.style.color = '#f44336'; // Red color for warning
      
      setTimeout(() => {
        btnElement.innerHTML = originalIcon;
        btnElement.style.color = ''; // Reset color
      }, 1500);
      return;
    }

    const newItem = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2),
      word: data.word,
      reading: data.reading,
      context: data.context,
      tokens: data.tokens,
      translation: data.translation,
      addedAt: Date.now(),
      nextReview: Date.now(), // Due immediately
      level: 0
    };

    vocabulary.push(newItem);
    
    chrome.storage.local.set({ fudoki_vocabulary: vocabulary }, () => {
      // Success feedback
      btnElement.innerHTML = `<span style="font-size:12px; white-space:nowrap; font-weight:bold;">${msg.added}</span>`;
      btnElement.style.color = '#4caf50';
      
      setTimeout(() => {
        btnElement.innerHTML = originalIcon;
        btnElement.style.color = '';
      }, 1500);
    });
  });
}

// Ensure voices are loaded (Chrome requires this sometimes)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
  };
}
