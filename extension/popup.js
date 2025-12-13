document.addEventListener('DOMContentLoaded', () => {
  const enableCheckbox = document.getElementById('enable-extension');
  const readingModeSelect = document.getElementById('reading-mode');
  const showRomajiCheckbox = document.getElementById('show-romaji');
  const showPosCheckbox = document.getElementById('show-pos');
  const translateTargetSelect = document.getElementById('translate-target');
  const themeSelect = document.getElementById('theme-select');
  const ttsSpeedInput = document.getElementById('tts-speed');
  const ttsSpeedVal = document.getElementById('tts-speed-val');
  const languageSelect = document.getElementById('language-select');

  const translations = {
    en: {
      settingsTitle: "Fudoki Reader Settings",
      enableExtension: "Enable Extension",
      readingMode: "Reading Mode",
      modeHiragana: "Hiragana",
      modeKatakana: "Katakana",
      modeRomaji: "Romaji",
      modeNone: "None",
      showRomaji: "Show Romaji (Sub)",
      showPos: "Show Part of Speech",
      translateTarget: "Translation Target",
      langZh: "Chinese (Simplified)",
      langEn: "English",
      langNone: "None (Hide)",
      theme: "Theme",
      themeSystem: "System",
      themeLight: "Light",
      themeDark: "Dark",
      ttsSpeed: "TTS Speed"
    },
    zh: {
      settingsTitle: "Fudoki Reader 设置",
      enableExtension: "启用扩展",
      readingMode: "注音模式",
      modeHiragana: "平假名",
      modeKatakana: "片假名",
      modeRomaji: "罗马音",
      modeNone: "无",
      showRomaji: "显示罗马音 (副)",
      showPos: "显示词性",
      translateTarget: "翻译目标语言",
      langZh: "简体中文",
      langEn: "英语",
      langNone: "无 (隐藏)",
      theme: "主题",
      themeSystem: "跟随系统",
      themeLight: "浅色",
      themeDark: "深色",
      ttsSpeed: "朗读速度"
    },
    ja: {
      settingsTitle: "Fudoki Reader 設定",
      enableExtension: "拡張機能を有効化",
      readingMode: "読み仮名モード",
      modeHiragana: "ひらがな",
      modeKatakana: "カタカナ",
      modeRomaji: "ローマ字",
      modeNone: "なし",
      showRomaji: "ローマ字を表示 (副)",
      showPos: "品詞を表示",
      translateTarget: "翻訳ターゲット",
      langZh: "中国語 (簡体字)",
      langEn: "英語",
      langNone: "なし (非表示)",
      theme: "テーマ",
      themeSystem: "システム",
      themeLight: "ライト",
      themeDark: "ダーク",
      ttsSpeed: "読み上げ速度"
    }
  };

  function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    }
  }

  function updateLanguage(lang) {
    const t = translations[lang] || translations.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        el.textContent = t[key];
      }
    });
  }

  // Load current state
  chrome.storage.local.get(['fudoki_enabled', 'fudoki_reading_mode', 'fudoki_show_romaji', 'fudoki_show_pos', 'fudoki_translate_target', 'fudoki_theme', 'fudoki_tts_speed', 'fudoki_language'], (result) => {
    enableCheckbox.checked = result.fudoki_enabled !== false;
    readingModeSelect.value = result.fudoki_reading_mode || 'hiragana';
    showRomajiCheckbox.checked = result.fudoki_show_romaji === true;
    showPosCheckbox.checked = result.fudoki_show_pos === true;
    translateTargetSelect.value = result.fudoki_translate_target || 'zh-CN';
    themeSelect.value = result.fudoki_theme || 'system';
    languageSelect.value = result.fudoki_language || 'en';
    
    const speed = result.fudoki_tts_speed || 1.0;
    ttsSpeedInput.value = speed;
    ttsSpeedVal.textContent = speed;

    updateLanguage(languageSelect.value);
    applyTheme(themeSelect.value);
  });

  function updateSettings() {
    const settings = {
      fudoki_enabled: enableCheckbox.checked,
      fudoki_reading_mode: readingModeSelect.value,
      fudoki_show_romaji: showRomajiCheckbox.checked,
      fudoki_show_pos: showPosCheckbox.checked,
      fudoki_translate_target: translateTargetSelect.value,
      fudoki_theme: themeSelect.value,
      fudoki_tts_speed: parseFloat(ttsSpeedInput.value),
      fudoki_language: languageSelect.value
    };

    applyTheme(settings.fudoki_theme);

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

  // Language change handler
  languageSelect.addEventListener('change', () => {
    updateLanguage(languageSelect.value);
    updateSettings();
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
