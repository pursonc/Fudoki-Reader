document.addEventListener('DOMContentLoaded', () => {
  const enableCheckbox = document.getElementById('enable-extension');
  const readingModeSelect = document.getElementById('reading-mode');
  const showRomajiCheckbox = document.getElementById('show-romaji');
  const showPosCheckbox = document.getElementById('show-pos');
  const translateTargetSelect = document.getElementById('translate-target');
  const themeSelect = document.getElementById('theme-select');
  const ttsSpeedInput = document.getElementById('tts-speed');
  const ttsSpeedVal = document.getElementById('tts-speed-val');

  // Load current state
  chrome.storage.local.get(['fudoki_enabled', 'fudoki_reading_mode', 'fudoki_show_romaji', 'fudoki_show_pos', 'fudoki_translate_target', 'fudoki_theme', 'fudoki_tts_speed'], (result) => {
    enableCheckbox.checked = result.fudoki_enabled !== false;
    readingModeSelect.value = result.fudoki_reading_mode || 'hiragana';
    showRomajiCheckbox.checked = result.fudoki_show_romaji === true;
    showPosCheckbox.checked = result.fudoki_show_pos === true;
    translateTargetSelect.value = result.fudoki_translate_target || 'zh-CN';
    themeSelect.value = result.fudoki_theme || 'system';
    
    const speed = result.fudoki_tts_speed || 1.0;
    ttsSpeedInput.value = speed;
    ttsSpeedVal.textContent = speed;
  });

  function updateSettings() {
    const settings = {
      fudoki_enabled: enableCheckbox.checked,
      fudoki_reading_mode: readingModeSelect.value,
      fudoki_show_romaji: showRomajiCheckbox.checked,
      fudoki_show_pos: showPosCheckbox.checked,
      fudoki_translate_target: translateTargetSelect.value,
      fudoki_theme: themeSelect.value,
      fudoki_tts_speed: parseFloat(ttsSpeedInput.value)
    };

    chrome.storage.local.set(settings);
    
    // Notify content scripts
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_SETTINGS',
          settings: settings
        });
      }
    });
  }

  // Update speed display
  ttsSpeedInput.addEventListener('input', () => {
    ttsSpeedVal.textContent = ttsSpeedInput.value;
  });

  // Save state on change
  enableCheckbox.addEventListener('change', updateSettings);
  readingModeSelect.addEventListener('change', updateSettings);
  showRomajiCheckbox.addEventListener('change', updateSettings);
  showPosCheckbox.addEventListener('change', updateSettings);
  translateTargetSelect.addEventListener('change', updateSettings);
  themeSelect.addEventListener('change', updateSettings);
  ttsSpeedInput.addEventListener('change', updateSettings);
});
