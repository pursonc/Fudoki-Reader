const FUDOKI_FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfjJZ7TOevSTNbtfk0PuBCpK8W3eO-YvWnMvXu4l5-b2TeUTQ/viewform?usp=dialog';
const FUDOKI_WISE_TAG_URL = 'https://wise.com/pay/me/puxinc1?utm_source=request_flow';

document.addEventListener('DOMContentLoaded', () => {
  const enableCheckbox = document.getElementById('enable-extension');
  const inlineEnabledCheckbox = document.getElementById('inline-enabled');
  const readingModeSelect = document.getElementById('reading-mode');
  const shortMeaningCheckbox = document.getElementById('short-meaning');
  const sentenceTranslationCheckbox = document.getElementById('sentence-translation');
  const translateTargetSelect = document.getElementById('translate-target');
  const themeSelect = document.getElementById('theme-select');
  const ttsSpeedInput = document.getElementById('tts-speed');
  const ttsSpeedVal = document.getElementById('tts-speed-val');
  const languageFlags = document.querySelectorAll('.lang-flag');
  const openVocabBtn = document.getElementById('open-vocab');
  const feedbackBtn = document.getElementById('feedback-btn');
  const versionLabel = document.getElementById('version-label');
  const updateBanner = document.getElementById('update-banner');
  const updateMessage = document.getElementById('update-message');
  const dismissUpdateBtn = document.getElementById('dismiss-update');
  let currentLang = 'zh';
  let updateNotice = null;

  const translations = {
    en: {
      settingsTitle: 'Fudoki Reader',
      openVocab: 'Vocabulary',
      enableExtension: 'Enable extension',
      inlineEnabled: 'Inline readings',
      readingMode: 'Reading',
      modeHiragana: 'Hiragana',
      modeKatakana: 'Katakana',
      modeRomaji: 'Romaji',
      shortMeaning: 'Short meanings',
      sentenceTranslation: 'Sentence translation',
      translateTarget: 'Translate to',
      langZh: 'Chinese',
      langEn: 'English',
      langNone: 'Off',
      sentenceNote: 'Sentence text is sent only after you click and confirm.',
      ttsSpeed: 'Speech speed',
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      feedback: 'Send feedback',
      coffeeSupport: 'Buy me a coffee · 1 USD',
      mealSupport: 'Buy me a nice meal · 5 USD',
      customAmount: 'Choose an amount',
      updatedTo: 'Updated to'
    },
    zh: {
      settingsTitle: 'Fudoki Reader',
      openVocab: '生词本',
      enableExtension: '启用扩展',
      inlineEnabled: '页面注音',
      readingMode: '读音',
      modeHiragana: '平假名',
      modeKatakana: '片假名',
      modeRomaji: 'Romaji',
      shortMeaning: '词级短译',
      sentenceTranslation: '句级译文',
      translateTarget: '译文语言',
      langZh: '简体中文',
      langEn: '英语',
      langNone: '关闭',
      sentenceNote: '句译只在你点击句子并确认后发送文本。',
      ttsSpeed: '朗读速度',
      theme: '主题',
      themeSystem: '跟随系统',
      themeLight: '浅色',
      themeDark: '深色',
      feedback: '反馈建议',
      coffeeSupport: '请我喝杯咖啡 · 1 USD',
      mealSupport: '请我吃顿美餐 · 5 USD',
      customAmount: '随心支持',
      updatedTo: '已更新至'
    },
    ja: {
      settingsTitle: 'Fudoki Reader',
      openVocab: '単語帳',
      enableExtension: '拡張機能',
      inlineEnabled: 'ページにルビ',
      readingMode: '読み',
      modeHiragana: 'ひらがな',
      modeKatakana: 'カタカナ',
      modeRomaji: 'Romaji',
      shortMeaning: '短い意味',
      sentenceTranslation: '文の翻訳',
      translateTarget: '翻訳先',
      langZh: '中国語',
      langEn: '英語',
      langNone: 'オフ',
      sentenceNote: '文はクリックして確認した時だけ送信されます。',
      ttsSpeed: '読み上げ速度',
      theme: 'テーマ',
      themeSystem: 'システム',
      themeLight: 'ライト',
      themeDark: 'ダーク',
      feedback: 'フィードバック',
      coffeeSupport: 'コーヒーを一杯 · 1 USD',
      mealSupport: 'ご飯をごちそう · 5 USD',
      customAmount: '金額を選ぶ',
      updatedTo: '更新しました'
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
    currentLang = lang;
    const t = translations[lang] || translations.zh;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) el.textContent = t[key];
    });
    languageFlags.forEach((flag) => {
      flag.classList.toggle('active', flag.dataset.lang === lang);
    });
    renderUpdateNotice();
  }

  function renderUpdateNotice() {
    if (!updateNotice) {
      updateBanner.hidden = true;
      return;
    }
    const t = translations[currentLang] || translations.zh;
    updateMessage.textContent = `${t.updatedTo} v${updateNotice.version}`;
    updateBanner.hidden = false;
  }

  const currentVersion = chrome.runtime.getManifest().version;
  versionLabel.textContent = `v${currentVersion}`;

  chrome.storage.local.get([
    'fudoki_enabled',
    'fudoki_reading_mode',
    'fudoki_translate_target',
    'fudoki_theme',
    'fudoki_tts_speed',
    'fudoki_language',
    'fudoki_inline_enabled',
    'fudoki_inline_short_meaning',
    'fudoki_inline_sentence_translation',
    'fudoki_update_notice'
  ], (result) => {
    enableCheckbox.checked = result.fudoki_enabled !== false;
    inlineEnabledCheckbox.checked = result.fudoki_inline_enabled === true;
    readingModeSelect.value = normalizeReadingMode(result.fudoki_reading_mode);
    shortMeaningCheckbox.checked = result.fudoki_inline_short_meaning === true;
    sentenceTranslationCheckbox.checked = result.fudoki_inline_sentence_translation === true;
    translateTargetSelect.value = result.fudoki_translate_target || 'zh-CN';
    themeSelect.value = result.fudoki_theme || 'system';

    const speed = result.fudoki_tts_speed || 1.0;
    ttsSpeedInput.value = speed;
    ttsSpeedVal.textContent = speed;

    updateNotice = result.fudoki_update_notice || null;
    updateLanguage(result.fudoki_language || 'zh');
    applyTheme(themeSelect.value);
  });

  function collectSettings() {
    if (shortMeaningCheckbox.checked && sentenceTranslationCheckbox.checked) {
      sentenceTranslationCheckbox.checked = false;
    }
    return {
      fudoki_enabled: enableCheckbox.checked,
      fudoki_reading_mode: normalizeReadingMode(readingModeSelect.value),
      fudoki_translate_target: translateTargetSelect.value,
      fudoki_theme: themeSelect.value,
      fudoki_tts_speed: parseFloat(ttsSpeedInput.value),
      fudoki_language: currentLang,
      fudoki_inline_enabled: inlineEnabledCheckbox.checked,
      fudoki_inline_short_meaning: shortMeaningCheckbox.checked,
      fudoki_inline_sentence_translation: sentenceTranslationCheckbox.checked
    };
  }

  function updateSettings() {
    const settings = collectSettings();
    applyTheme(settings.fudoki_theme);
    chrome.storage.local.set(settings);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_SETTINGS',
        settings
      }, () => {
        chrome.runtime.lastError;
      });
    });
  }

  function normalizeReadingMode(mode) {
    return ['hiragana', 'katakana', 'romaji'].includes(mode) ? mode : 'hiragana';
  }

  function openConfiguredUrl(url, fallbackMessage) {
    if (url.includes('REPLACE_WITH_')) {
      alert(fallbackMessage);
      return;
    }
    chrome.tabs.create({ url });
  }

  function openWise(amount) {
    if (FUDOKI_WISE_TAG_URL.includes('REPLACE_WITH_')) {
      alert('请先把 Wisetag 链接填入 FUDOKI_WISE_TAG_URL。');
      return;
    }
    const url = new URL(FUDOKI_WISE_TAG_URL);
    if (amount && amount !== 'custom') {
      url.searchParams.set('amount', amount);
      url.searchParams.set('currency', 'USD');
    }
    chrome.tabs.create({ url: url.toString() });
  }

  ttsSpeedInput.addEventListener('input', () => {
    ttsSpeedVal.textContent = ttsSpeedInput.value;
  });

  languageFlags.forEach((flag) => {
    flag.addEventListener('click', () => {
      updateLanguage(flag.dataset.lang);
      updateSettings();
    });
  });

  openVocabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'vocabulary.html' });
  });

  feedbackBtn.addEventListener('click', () => {
    openConfiguredUrl(FUDOKI_FEEDBACK_URL, '请先把 Google Form 链接填入 FUDOKI_FEEDBACK_URL。');
  });

  dismissUpdateBtn.addEventListener('click', () => {
    updateNotice = null;
    updateBanner.hidden = true;
    chrome.storage.local.remove('fudoki_update_notice');
    chrome.action.setBadgeText({ text: '' });
  });

  shortMeaningCheckbox.addEventListener('change', () => {
    if (shortMeaningCheckbox.checked) {
      sentenceTranslationCheckbox.checked = false;
    }
    updateSettings();
  });

  sentenceTranslationCheckbox.addEventListener('change', () => {
    if (sentenceTranslationCheckbox.checked) {
      shortMeaningCheckbox.checked = false;
    }
    updateSettings();
  });

  document.querySelectorAll('.support-btn').forEach((button) => {
    button.addEventListener('click', () => openWise(button.dataset.amount));
  });

  [
    enableCheckbox,
    inlineEnabledCheckbox,
    readingModeSelect,
    translateTargetSelect,
    themeSelect,
    ttsSpeedInput
  ].forEach((control) => {
    control.addEventListener('change', updateSettings);
  });
});
