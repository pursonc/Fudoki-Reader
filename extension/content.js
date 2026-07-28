// Fudoki Content Script

const FUDOKI_FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfjJZ7TOevSTNbtfk0PuBCpK8W3eO-YvWnMvXu4l5-b2TeUTQ/viewform?usp=dialog';
const FUDOKI_WISE_TAG_URL = 'https://wise.com/pay/me/puxinc1?utm_source=request_flow';
const FUDOKI_LOGO_URL = chrome.runtime.getURL('static/logo.png');
const INLINE_SCAN_LIMIT = 140;
const INLINE_CHAR_LIMIT = 12000;
const INLINE_NODE_CHAR_LIMIT = 700;
const JAPANESE_PAGE_SAMPLE_LIMIT = 6000;
const MIN_JAPANESE_CHARS_FOR_PAGE = 24;
const MIN_JAPANESE_RATIO_FOR_PAGE = 0.08;

let currentPopup = null;
let isJapanesePage = false;
let inlineState = {
  enabled: false,
  shortMeaning: false,
  sentenceTranslation: false,
  readingMode: 'hiragana',
  annotated: new Set(),
  pending: new Set(),
  observer: null,
  queue: Promise.resolve(),
  processedChars: 0,
  sentenceConsent: false
};

let settings = {
  fudoki_enabled: true,
  fudoki_reading_mode: 'hiragana',
  fudoki_translate_target: 'zh-CN',
  fudoki_theme: 'system',
  fudoki_tts_speed: 1.0,
  fudoki_language: 'zh',
  fudoki_inline_enabled: false,
  fudoki_inline_short_meaning: false,
  fudoki_inline_sentence_translation: false
};

const CONTENT_TRANSLATIONS = {
  en: {
    inlineReading: 'Inline readings',
    shortMeaning: 'Short meanings',
    sentenceTranslation: 'Sentence translation',
    reading: 'Reading',
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    rerender: 'Render again',
    restore: 'Restore page',
    feedback: 'Send feedback',
    coffeeSupport: 'Buy me a coffee · 1 USD',
    mealSupport: 'Buy me a nice meal · 5 USD',
    customSupport: 'Choose an amount',
    statusInitial: 'Turn on inline readings to begin.',
    statusAnnotating: 'Adding readings to visible Japanese text.',
    statusInlineOff: 'Inline readings are off.',
    statusShortOnRender: 'Short meanings are on. Rendering again.',
    statusShortOffRender: 'Short meanings are off. Rendering again.',
    statusShortOn: 'Short meanings are on for common words.',
    statusShortOff: 'Short meanings are off.',
    statusSentenceOnRender: 'Sentence translation is on. Rendering again.',
    statusSentenceOffRender: 'Sentence translation is off. Rendering again.',
    statusSentenceOn: 'Sentence translation is on. Click a sentence to translate.',
    statusSentenceOff: 'Sentence translation is off.',
    statusRerendering: 'Rendering the current page again.',
    statusTurnOnInline: 'Turn on inline readings first.',
    statusPageTooLong: 'Automatic readings paused on this long page.',
    statusProcessed: 'Processed about {count} characters.',
    statusRestored: 'The page has been restored.',
    sentenceConsent: 'Sentence translation sends this sentence to the translation service. Continue?',
    translating: 'Translating...',
    translationFailed: 'Translation failed',
    analyzing: 'Analyzing...',
    speed: 'Speed',
    previousWord: 'Previous word',
    readAloud: 'Read aloud',
    nextWord: 'Next word',
    translate: 'Translate',
    restart: 'Read from start',
    save: 'Save',
    sentenceResult: 'Sentence translation: {text}',
    posNoun: 'N',
    posVerb: 'V',
    posAdjective: 'Adj',
    posAdverb: 'Adv',
    posParticle: 'Part',
    posAuxiliary: 'Aux',
    posConjunction: 'Conj',
    posAdnominal: 'Adn',
    posInterjection: 'Int'
  },
  zh: {
    inlineReading: '页面注音',
    shortMeaning: '短译',
    sentenceTranslation: '句译',
    reading: '读音',
    hiragana: '平假名',
    katakana: '片假名',
    rerender: '重新渲染',
    restore: '恢复页面',
    feedback: '反馈建议',
    coffeeSupport: '请我喝杯咖啡 · 1 USD',
    mealSupport: '请我吃顿美餐 · 5 USD',
    customSupport: '随心支持',
    statusInitial: '选择“页面注音”开始。',
    statusAnnotating: '正在给可见日文加注音。',
    statusInlineOff: '页面注音已关闭。',
    statusShortOnRender: '短译已开启，正在重新渲染。',
    statusShortOffRender: '短译已关闭，正在重新渲染。',
    statusShortOn: '短译已开启：先显示少量常见词。',
    statusShortOff: '短译已关闭。',
    statusSentenceOnRender: '句译已开启，正在重新渲染。',
    statusSentenceOffRender: '句译已关闭，正在重新渲染。',
    statusSentenceOn: '句译已开启：点击句子后确认翻译。',
    statusSentenceOff: '句译已关闭。',
    statusRerendering: '正在重新渲染当前页面。',
    statusTurnOnInline: '先打开页面注音。',
    statusPageTooLong: '本页较长，已暂停自动注音。',
    statusProcessed: '已处理约 {count} 个字符。',
    statusRestored: '页面已恢复。',
    sentenceConsent: '句译会把这一句发送到翻译服务。是否继续？',
    translating: '翻译中...',
    translationFailed: '翻译失败',
    analyzing: '分析中...',
    speed: '速度',
    previousWord: '上一个词',
    readAloud: '朗读',
    nextWord: '下一个词',
    translate: '翻译',
    restart: '从头朗读',
    save: '收藏',
    sentenceResult: '整句翻译：{text}',
    posNoun: '名',
    posVerb: '动',
    posAdjective: '形',
    posAdverb: '副',
    posParticle: '助',
    posAuxiliary: '助动',
    posConjunction: '接',
    posAdnominal: '连',
    posInterjection: '感'
  },
  ja: {
    inlineReading: 'ページにルビ',
    shortMeaning: '短い意味',
    sentenceTranslation: '文の翻訳',
    reading: '読み',
    hiragana: 'ひらがな',
    katakana: 'カタカナ',
    rerender: '再表示',
    restore: '元に戻す',
    feedback: 'フィードバック',
    coffeeSupport: 'コーヒーを一杯 · 1 USD',
    mealSupport: 'ご飯をごちそう · 5 USD',
    customSupport: '金額を選ぶ',
    statusInitial: '「ページにルビ」をオンにしてください。',
    statusAnnotating: '表示中の日本語にルビを追加しています。',
    statusInlineOff: 'ページのルビはオフです。',
    statusShortOnRender: '短い意味をオンにして再表示しています。',
    statusShortOffRender: '短い意味をオフにして再表示しています。',
    statusShortOn: 'よく使う語の短い意味を表示します。',
    statusShortOff: '短い意味はオフです。',
    statusSentenceOnRender: '文の翻訳をオンにして再表示しています。',
    statusSentenceOffRender: '文の翻訳をオフにして再表示しています。',
    statusSentenceOn: '文の翻訳はオンです。文をクリックしてください。',
    statusSentenceOff: '文の翻訳はオフです。',
    statusRerendering: '現在のページを再表示しています。',
    statusTurnOnInline: '先にページのルビをオンにしてください。',
    statusPageTooLong: '長いページのため、自動ルビを一時停止しました。',
    statusProcessed: '約 {count} 文字を処理しました。',
    statusRestored: 'ページを元に戻しました。',
    sentenceConsent: 'この文を翻訳サービスへ送信します。続けますか？',
    translating: '翻訳中...',
    translationFailed: '翻訳できませんでした',
    analyzing: '解析中...',
    speed: '速度',
    previousWord: '前の語',
    readAloud: '読み上げ',
    nextWord: '次の語',
    translate: '翻訳',
    restart: '最初から読む',
    save: '保存',
    sentenceResult: '文の翻訳：{text}',
    posNoun: '名',
    posVerb: '動',
    posAdjective: '形',
    posAdverb: '副',
    posParticle: '助',
    posAuxiliary: '助動',
    posConjunction: '接',
    posAdnominal: '連',
    posInterjection: '感'
  }
};

function getUiLanguage() {
  return ['en', 'zh', 'ja'].includes(settings.fudoki_language) ? settings.fudoki_language : 'zh';
}

function uiText(key, values = {}) {
  const language = getUiLanguage();
  const template = CONTENT_TRANSLATIONS[language]?.[key] || CONTENT_TRANSLATIONS.zh[key] || key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

const SIMPLE_MEANINGS = {
  私: '我',
  僕: '我',
  彼: '他',
  彼女: '她',
  今日: '今天',
  明日: '明天',
  昨日: '昨天',
  日本: '日本',
  人: '人',
  本: '书',
  学校: '学校',
  先生: '老师',
  学生: '学生',
  友達: '朋友',
  家: '家',
  時間: '时间',
  言葉: '词语',
  物語: '故事',
  世界: '世界',
  心: '心',
  夢: '梦',
  愛: '爱',
  食べる: '吃',
  飲む: '喝',
  見る: '看',
  行く: '去',
  来る: '来',
  読む: '读',
  書く: '写',
  話す: '说',
  思う: '想',
  大きい: '大的',
  小さい: '小的',
  新しい: '新的',
  古い: '旧的',
  美しい: '美的',
  静か: '安静',
  好き: '喜欢',
  必要: '需要'
};

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/;
const KANJI_RE = /[\u3400-\u9fff]/;
const BLOCK_SELECTOR = [
  'article',
  'main',
  'section',
  'p',
  'li',
  'blockquote',
  'td',
  'dd',
  'dt',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
].join(',');

safeStorageGet([
  'fudoki_enabled',
  'fudoki_reading_mode',
  'fudoki_translate_target',
  'fudoki_theme',
  'fudoki_tts_speed',
  'fudoki_language',
  'fudoki_inline_enabled',
  'fudoki_inline_short_meaning',
  'fudoki_inline_sentence_translation'
], (result) => {
  if (!result) return;
  settings = { ...settings, ...result };
  isJapanesePage = detectJapanesePage();
  if (!isJapanesePage || settings.fudoki_enabled === false) return;
  inlineState.readingMode = normalizeReadingMode(settings.fudoki_reading_mode);
  inlineState.shortMeaning = !!settings.fudoki_inline_short_meaning;
  inlineState.sentenceTranslation = !!settings.fudoki_inline_sentence_translation;
  normalizeTranslationModes();
  buildRail();
  if (settings.fudoki_inline_enabled) {
    setInlineEnabled(true);
  }
});

if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'UPDATE_SETTINGS') return;
    const previousLanguage = getUiLanguage();
    if (message.settings) {
      settings = { ...settings, ...message.settings };
    } else if (typeof message.enabled !== 'undefined') {
      settings.fudoki_enabled = message.enabled;
    }

    isJapanesePage = detectJapanesePage();
    if (!isJapanesePage || settings.fudoki_enabled === false) {
      restoreInlineAnnotations({ persist: false });
      removePopup();
      removeRail();
      return;
    }

    buildRail();
    updateContentTheme();
    if (previousLanguage !== getUiLanguage()) {
      updateRailLanguage();
      removePopup();
    }
    if (message.settings?.fudoki_reading_mode &&
        normalizeReadingMode(message.settings.fudoki_reading_mode) !== inlineState.readingMode) {
      inlineState.readingMode = normalizeReadingMode(message.settings.fudoki_reading_mode);
      updateInlineReadings();
    }
    let nextShortMeaning = !!settings.fudoki_inline_short_meaning;
    let nextSentenceTranslation = !!settings.fudoki_inline_sentence_translation;
    if (nextShortMeaning && nextSentenceTranslation) {
      nextSentenceTranslation = false;
      settings.fudoki_inline_sentence_translation = false;
      safeStorageSet({ fudoki_inline_sentence_translation: false });
    }
    if (nextShortMeaning !== inlineState.shortMeaning) {
      setShortMeaning(nextShortMeaning);
    }
    if (nextSentenceTranslation !== inlineState.sentenceTranslation) {
      setSentenceTranslation(nextSentenceTranslation);
    }
    if (typeof message.settings?.fudoki_inline_enabled !== 'undefined' &&
        message.settings.fudoki_inline_enabled !== inlineState.enabled) {
      setInlineEnabled(!!message.settings.fudoki_inline_enabled);
    }
    updateRailState();
  });
}

document.addEventListener('mouseup', (event) => {
  if (!isJapanesePage) return;
  safeStorageGet(['fudoki_enabled', 'fudoki_reading_mode', 'fudoki_theme', 'fudoki_tts_speed', 'fudoki_language'], (result) => {
    if (!result) return;
    settings = { ...settings, ...result };
    inlineState.readingMode = normalizeReadingMode(settings.fudoki_reading_mode || inlineState.readingMode);
    updateInlineReadings();
    updateContentTheme();

    if (!settings.fudoki_enabled) return;
    setTimeout(() => handleSelection(event), 10);
  });
});

document.addEventListener('mousedown', (event) => {
  if (currentPopup && !currentPopup.contains(event.target)) {
    removePopup();
  }
});

document.addEventListener('click', (event) => {
  if (isFudokiUi(event.target)) return;

  const token = event.target.closest && event.target.closest('.fudoki-inline-token');
  const canShowSentence = isJapanesePage &&
    inlineState.sentenceTranslation &&
    token &&
    !isInteractiveContent(event.target) &&
    !isInteractiveContent(token);

  if (canShowSentence) {
    const sentence = findSentenceForNode(token);
    if (sentence) {
      closeRail();
      showSentenceTranslation(sentence, token);
      return;
    }
  }

  closeFloatingUi();
}, true);

function buildRail() {
  if (document.getElementById('fudoki-reader-rail-host')) return;

  const host = document.createElement('div');
  host.id = 'fudoki-reader-rail-host';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        right: 12px;
        top: 35%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--rail-text);
        --rail-text: #172033;
        --rail-label: #263244;
        --rail-panel: rgba(255, 255, 255, 0.9);
        --rail-border: rgba(23, 32, 51, 0.12);
        --rail-shadow: rgba(15, 23, 42, 0.18);
        --rail-divider: rgba(23, 32, 51, 0.08);
        --rail-control: #fff;
        --rail-control-border: rgba(23, 32, 51, 0.14);
        --rail-hover: #f8fafc;
        --rail-note: #5b6677;
        --rail-switch: #cbd5e1;
      }
      :host(.fudoki-theme-dark) {
        --rail-text: #f4f4f5;
        --rail-label: #e4e4e7;
        --rail-panel: rgba(24, 24, 27, 0.92);
        --rail-border: rgba(255, 255, 255, 0.16);
        --rail-shadow: rgba(0, 0, 0, 0.42);
        --rail-divider: rgba(255, 255, 255, 0.1);
        --rail-control: #27272a;
        --rail-control-border: rgba(255, 255, 255, 0.16);
        --rail-hover: #3f3f46;
        --rail-note: #a1a1aa;
        --rail-switch: #52525b;
      }
      * { box-sizing: border-box; }
      button, select, input { font: inherit; }
      .rail {
        width: 54px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
        overflow: hidden;
      }
      .rail.open {
        width: min(236px, calc(100vw - 24px));
        border-color: var(--rail-border);
        background: var(--rail-panel);
        box-shadow: 0 10px 34px var(--rail-shadow);
        backdrop-filter: blur(12px);
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 52px;
        padding: 7px;
        border-bottom: 1px solid var(--rail-divider);
      }
      .brand {
        display: none;
        min-width: 0;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0;
      }
      .rail.open .brand { display: block; }
      .icon {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 10px;
        color: var(--rail-text);
        background: transparent;
        display: grid;
        place-items: center;
        cursor: pointer;
        animation: fudoki-pulse 2.8s ease-in-out infinite;
      }
      .rail.open .icon { animation: none; }
      .icon:hover { background: rgba(37, 99, 235, 0.08); transform: translateY(-1px); }
      .icon img { width: 26px; height: 26px; border-radius: 6px; display: block; }
      @keyframes fudoki-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.26); }
        50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
      }
      .body {
        display: none;
        padding: 10px;
      }
      .rail.open .body { display: grid; gap: 10px; }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 30px;
      }
      .label {
        font-size: 12px;
        color: var(--rail-label);
        white-space: nowrap;
      }
      .switch {
        position: relative;
        width: 38px;
        height: 22px;
        border: 0;
        border-radius: 999px;
        background: var(--rail-switch);
        cursor: pointer;
        flex: 0 0 auto;
      }
      .switch::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.24);
        transition: transform 0.16s ease;
      }
      .switch.on { background: #2563eb; }
      .switch.on::after { transform: translateX(16px); }
      select, .amount {
        border: 1px solid var(--rail-control-border);
        background: var(--rail-control);
        border-radius: 6px;
        color: var(--rail-text);
      }
      select {
        width: 112px;
        min-height: 30px;
        padding: 3px 6px;
        font-size: 12px;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
      }
      .amount {
        min-height: 30px;
        padding: 3px 6px;
        font-size: 12px;
        cursor: pointer;
      }
      .plain {
        min-height: 32px;
        width: 100%;
        border: 1px solid var(--rail-control-border);
        border-radius: 6px;
        background: var(--rail-control);
        color: var(--rail-text);
        font-size: 12px;
        cursor: pointer;
      }
      .plain:hover, .amount:hover { background: var(--rail-hover); }
      .note {
        font-size: 11px;
        line-height: 1.4;
        color: var(--rail-note);
      }
      @media (max-width: 720px) {
        :host { right: 8px; top: auto; bottom: 18px; }
      }
    </style>
    <div class="rail" part="rail">
      <div class="top">
        <button class="icon" id="fudoki-rail-toggle" title="Fudoki Reader" aria-label="Fudoki Reader">
          <img src="${FUDOKI_LOGO_URL}" alt="">
        </button>
        <div class="brand">Fudoki</div>
      </div>
      <div class="body">
        <div class="row">
          <span class="label" data-i18n="inlineReading"></span>
          <button class="switch" id="fudoki-inline-toggle" data-i18n-aria="inlineReading"></button>
        </div>
        <div class="row">
          <span class="label" data-i18n="shortMeaning"></span>
          <button class="switch" id="fudoki-meaning-toggle" data-i18n-aria="shortMeaning"></button>
        </div>
        <div class="row">
          <span class="label" data-i18n="sentenceTranslation"></span>
          <button class="switch" id="fudoki-sentence-toggle" data-i18n-aria="sentenceTranslation"></button>
        </div>
        <div class="row">
          <span class="label" data-i18n="reading"></span>
          <select id="fudoki-reading-select" data-i18n-aria="reading">
            <option value="hiragana" data-i18n="hiragana"></option>
            <option value="katakana" data-i18n="katakana"></option>
            <option value="romaji">Romaji</option>
          </select>
        </div>
        <button class="plain" id="fudoki-rerender-btn" data-i18n="rerender"></button>
        <button class="plain" id="fudoki-restore-btn" data-i18n="restore"></button>
        <button class="plain" id="fudoki-feedback-btn" data-i18n="feedback"></button>
        <div class="actions">
          <button class="amount" data-amount="1" data-i18n="coffeeSupport"></button>
          <button class="amount" data-amount="5" data-i18n="mealSupport"></button>
          <button class="amount" data-amount="custom" data-i18n="customSupport"></button>
        </div>
        <div class="note" id="fudoki-status"></div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(host);

  const rail = shadow.querySelector('.rail');
  const toggle = shadow.getElementById('fudoki-rail-toggle');
  const inlineToggle = shadow.getElementById('fudoki-inline-toggle');
  const meaningToggle = shadow.getElementById('fudoki-meaning-toggle');
  const sentenceToggle = shadow.getElementById('fudoki-sentence-toggle');
  const readingSelect = shadow.getElementById('fudoki-reading-select');

  toggle.addEventListener('click', () => rail.classList.toggle('open'));
  inlineToggle.addEventListener('click', () => setInlineEnabled(!inlineState.enabled));
  meaningToggle.addEventListener('click', () => setShortMeaning(!inlineState.shortMeaning));
  sentenceToggle.addEventListener('click', () => setSentenceTranslation(!inlineState.sentenceTranslation));
  readingSelect.addEventListener('change', () => setReadingMode(readingSelect.value));
  shadow.getElementById('fudoki-rerender-btn').addEventListener('click', rerenderPage);
  shadow.getElementById('fudoki-restore-btn').addEventListener('click', restorePage);
  shadow.getElementById('fudoki-feedback-btn').addEventListener('click', () => {
    openConfiguredUrl(FUDOKI_FEEDBACK_URL, 'Google Form link is not configured.');
  });
  shadow.querySelectorAll('.amount').forEach((button) => {
    button.addEventListener('click', () => openWise(button.dataset.amount));
  });

  updateRailLanguage();
  updateContentTheme();
  updateRailState(uiText('statusInitial'));
}

function removeRail() {
  document.getElementById('fudoki-reader-rail-host')?.remove();
}

function updateRailLanguage() {
  const root = document.getElementById('fudoki-reader-rail-host')?.shadowRoot;
  if (!root) return;

  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = uiText(element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', uiText(element.dataset.i18nAria));
  });
  const status = inlineState.enabled ? uiText('statusAnnotating') : uiText('statusInitial');
  const statusElement = root.getElementById('fudoki-status');
  if (statusElement) statusElement.textContent = status;
}

function shouldUseDarkTheme() {
  return settings.fudoki_theme === 'dark' ||
    (settings.fudoki_theme === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function updateContentTheme() {
  const useDarkTheme = shouldUseDarkTheme();
  document.documentElement.classList.toggle('fudoki-reader-dark', useDarkTheme);
  document.getElementById('fudoki-reader-rail-host')?.classList.toggle('fudoki-theme-dark', useDarkTheme);
  currentPopup?.classList.toggle('fudoki-theme-dark', useDarkTheme);
}

function updateRailState(status) {
  const host = document.getElementById('fudoki-reader-rail-host');
  if (!host || !host.shadowRoot) return;

  const root = host.shadowRoot;
  root.getElementById('fudoki-inline-toggle')?.classList.toggle('on', inlineState.enabled);
  root.getElementById('fudoki-meaning-toggle')?.classList.toggle('on', inlineState.shortMeaning);
  root.getElementById('fudoki-sentence-toggle')?.classList.toggle('on', inlineState.sentenceTranslation);
  const select = root.getElementById('fudoki-reading-select');
  if (select) select.value = inlineState.readingMode;
  const statusEl = root.getElementById('fudoki-status');
  if (statusEl && status) statusEl.textContent = status;
}

function setInlineEnabled(enabled) {
  isJapanesePage = detectJapanesePage();
  if (enabled && !isJapanesePage) {
    safeStorageSet({ fudoki_inline_enabled: false });
    return;
  }
  inlineState.enabled = enabled;
  settings.fudoki_inline_enabled = enabled;
  safeStorageSet({ fudoki_inline_enabled: enabled });
  updateRailState(enabled ? uiText('statusAnnotating') : uiText('statusInlineOff'));

  if (enabled) {
    rerenderPage();
  } else {
    restoreInlineAnnotations();
    updateRailState(uiText('statusInlineOff'));
  }
}

function setShortMeaning(enabled) {
  inlineState.shortMeaning = enabled;
  if (enabled) {
    inlineState.sentenceTranslation = false;
    settings.fudoki_inline_sentence_translation = false;
  }
  settings.fudoki_inline_short_meaning = enabled;
  safeStorageSet({
    fudoki_inline_short_meaning: enabled,
    fudoki_inline_sentence_translation: inlineState.sentenceTranslation
  });
  document.documentElement.classList.toggle('fudoki-show-meaning', enabled);
  if (inlineState.enabled) {
    rerenderPage(uiText(enabled ? 'statusShortOnRender' : 'statusShortOffRender'));
  } else {
    updateRailState(uiText(enabled ? 'statusShortOn' : 'statusShortOff'));
  }
}

function setSentenceTranslation(enabled) {
  inlineState.sentenceTranslation = enabled;
  if (enabled) {
    inlineState.shortMeaning = false;
    settings.fudoki_inline_short_meaning = false;
    document.documentElement.classList.remove('fudoki-show-meaning');
  }
  settings.fudoki_inline_sentence_translation = enabled;
  safeStorageSet({
    fudoki_inline_sentence_translation: enabled,
    fudoki_inline_short_meaning: inlineState.shortMeaning
  });
  if (inlineState.enabled) {
    rerenderPage(uiText(enabled ? 'statusSentenceOnRender' : 'statusSentenceOffRender'));
  } else {
    updateRailState(uiText(enabled ? 'statusSentenceOn' : 'statusSentenceOff'));
  }
}

function setReadingMode(mode) {
  inlineState.readingMode = normalizeReadingMode(mode);
  settings.fudoki_reading_mode = inlineState.readingMode;
  safeStorageSet({ fudoki_reading_mode: inlineState.readingMode });
  updateInlineReadings();
  updateRailState();
}

function normalizeReadingMode(mode) {
  return ['hiragana', 'katakana', 'romaji'].includes(mode) ? mode : 'hiragana';
}

function normalizeTranslationModes() {
  if (inlineState.shortMeaning && inlineState.sentenceTranslation) {
    inlineState.sentenceTranslation = false;
    settings.fudoki_inline_sentence_translation = false;
    safeStorageSet({ fudoki_inline_sentence_translation: false });
  }
}

function startInlineMode() {
  document.documentElement.classList.toggle('fudoki-show-meaning', inlineState.shortMeaning);
  observeVisibleBlocks();
  scanVisibleBlocks();
}

function rerenderPage(status = uiText('statusRerendering')) {
  if (!isJapanesePage || !inlineState.enabled) {
    updateRailState(uiText('statusTurnOnInline'));
    return;
  }
  restoreInlineAnnotations({ persist: false, keepEnabled: true });
  inlineState.enabled = true;
  settings.fudoki_inline_enabled = true;
  updateRailState(status);
  startInlineMode();
}

function observeVisibleBlocks() {
  stopInlineObserver();

  inlineState.observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) scheduleAnnotateBlock(entry.target);
    });
  }, { rootMargin: '240px 0px' });

  getCandidateBlocks().forEach((block) => inlineState.observer.observe(block));
}

function stopInlineObserver() {
  if (inlineState.observer) {
    inlineState.observer.disconnect();
    inlineState.observer = null;
  }
}

function scanVisibleBlocks() {
  getCandidateBlocks()
    .filter(isElementVisible)
    .slice(0, INLINE_SCAN_LIMIT)
    .forEach((block) => scheduleAnnotateBlock(block));
}

function getCandidateBlocks() {
  return Array.from(document.querySelectorAll(BLOCK_SELECTOR)).filter((element) => {
    if (isExcludedElement(element)) return false;
    const text = element.innerText || element.textContent || '';
    return text.length >= 2 && JAPANESE_RE.test(text);
  });
}

async function annotateBlock(block) {
  if (!inlineState.enabled || inlineState.pending.has(block) || isExcludedElement(block)) return;
  if (inlineState.processedChars >= INLINE_CHAR_LIMIT) {
    updateRailState(uiText('statusPageTooLong'));
    return;
  }

  const textNodes = getTextNodes(block).slice(0, 16);
  if (!textNodes.length) return;

  inlineState.pending.add(block);
  try {
    for (const textNode of textNodes) {
      if (!inlineState.enabled || !textNode.parentNode || isExcludedElement(textNode.parentElement)) continue;
      const raw = textNode.nodeValue || '';
      const text = raw.trim();
      if (!text || text.length > INLINE_NODE_CHAR_LIMIT || !JAPANESE_RE.test(text) || !KANJI_RE.test(text)) continue;
      if (inlineState.processedChars + text.length > INLINE_CHAR_LIMIT) break;

      try {
        const response = await safeRuntimeSendMessage({ type: 'ANALYZE_REQUEST', text: raw });
        if (response && response.success && Array.isArray(response.data)) {
          replaceTextNodeWithRuby(textNode, response.data, raw);
          inlineState.processedChars += text.length;
        }
      } catch (error) {
        console.warn('Fudoki inline annotation failed:', error);
      }
    }
  } finally {
    inlineState.pending.delete(block);
  }
  updateRailState(uiText('statusProcessed', { count: inlineState.processedChars }));
}

function scheduleAnnotateBlock(block) {
  if (!inlineState.enabled || inlineState.pending.has(block)) return;
  inlineState.queue = inlineState.queue
    .catch(() => {})
    .then(() => annotateBlock(block));
}

function getTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !JAPANESE_RE.test(node.nodeValue) || !KANJI_RE.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.parentElement || isExcludedElement(node.parentElement)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function replaceTextNodeWithRuby(textNode, tokens, originalText) {
  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement('span');
  wrapper.className = 'fudoki-inline-wrap';
  wrapper.dataset.originalText = originalText;
  let sourceOffset = 0;

  tokens.forEach((token) => {
    if (!token.surface) return;
    const matchedOffset = originalText.indexOf(token.surface, sourceOffset);
    const tokenStart = matchedOffset >= 0 ? matchedOffset : sourceOffset;
    sourceOffset = tokenStart + token.surface.length;

    const shouldAnnotate = KANJI_RE.test(token.surface) && getReading(token);
    if (!shouldAnnotate) {
      wrapper.appendChild(document.createTextNode(token.surface));
      return;
    }

    const tokenEl = document.createElement('span');
    tokenEl.className = 'fudoki-inline-token';
    tokenEl.dataset.hiragana = token.hiragana || '';
    tokenEl.dataset.katakana = token.reading || '';
    tokenEl.dataset.romaji = token.romaji || '';
    tokenEl.dataset.surface = token.surface;
    tokenEl.dataset.sourceStart = String(tokenStart);

    const ruby = document.createElement('ruby');
    const surface = document.createElement('span');
    surface.textContent = token.surface;
    const rt = document.createElement('rt');
    rt.textContent = getReading(token);
    ruby.append(surface, rt);
    tokenEl.appendChild(ruby);

    const meaning = getShortMeaning(token);
    if (meaning) {
      const meaningEl = document.createElement('span');
      meaningEl.className = 'fudoki-inline-meaning';
      meaningEl.textContent = meaning;
      tokenEl.appendChild(meaningEl);
    }

    wrapper.appendChild(tokenEl);
  });

  fragment.appendChild(wrapper);
  textNode.replaceWith(fragment);
  inlineState.annotated.add(wrapper);
}

function updateInlineReadings() {
  document.querySelectorAll('.fudoki-inline-token').forEach((token) => {
    const rt = token.querySelector('rt');
    if (rt) rt.textContent = token.dataset[inlineState.readingMode] || token.dataset.hiragana || '';
  });
  updateRailState();
}

function restorePage() {
  restoreInlineAnnotations();
  updateRailState(uiText('statusRestored'));
}

function restoreInlineAnnotations(options = {}) {
  const persist = options.persist !== false;
  const keepEnabled = options.keepEnabled === true;
  stopInlineObserver();
  inlineState.enabled = keepEnabled;
  inlineState.processedChars = 0;
  inlineState.pending.clear();
  inlineState.queue = Promise.resolve();
  if (persist) {
    safeStorageSet({ fudoki_inline_enabled: false });
  }

  Array.from(inlineState.annotated).forEach((wrapper) => {
    if (wrapper && wrapper.parentNode) {
      wrapper.replaceWith(document.createTextNode(wrapper.dataset.originalText || wrapper.textContent || ''));
    }
  });
  inlineState.annotated.clear();
}

function getReading(token) {
  if (inlineState.readingMode === 'katakana') return token.reading || token.hiragana || '';
  if (inlineState.readingMode === 'romaji') return token.romaji || token.hiragana || '';
  return token.hiragana || token.reading || '';
}

function getShortMeaning(token) {
  if (!token || !token.surface) return '';
  const pos = token.pos && token.pos[0];
  if (pos && ['助詞', '助動詞', '記号'].includes(pos)) return '';
  return SIMPLE_MEANINGS[token.surface] || '';
}

function detectJapanesePage() {
  const lang = `${document.documentElement.lang || ''} ${document.body?.lang || ''}`.toLowerCase();
  if (/\bja(?:-|_|$)/.test(lang)) return true;

  const text = getVisiblePageSample();
  if (!text) return false;

  const japaneseMatches = text.match(/[\u3040-\u30ff\u3400-\u9fff]/g);
  const japaneseCount = japaneseMatches ? japaneseMatches.length : 0;
  if (japaneseCount < MIN_JAPANESE_CHARS_FOR_PAGE) return false;

  const compactLength = text.replace(/\s/g, '').length || 1;
  return japaneseCount / compactLength >= MIN_JAPANESE_RATIO_FOR_PAGE;
}

function getVisiblePageSample() {
  const candidates = Array.from(document.querySelectorAll('article,main,[lang^="ja"],[lang*=" ja"],p,li,blockquote,h1,h2,h3'));
  let sample = '';

  for (const element of candidates) {
    if (sample.length >= JAPANESE_PAGE_SAMPLE_LIMIT) break;
    if (isExcludedElement(element) || !isElementVisible(element)) continue;
    const text = element.innerText || element.textContent || '';
    if (text) sample += ` ${text.slice(0, 800)}`;
  }

  return sample.slice(0, JAPANESE_PAGE_SAMPLE_LIMIT);
}

function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= -240 &&
    rect.top <= window.innerHeight + 240 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none';
}

function isExcludedElement(element) {
  if (!element) return true;
  const blocked = 'a,input,textarea,select,button,nav,code,pre,script,style,noscript,ruby,rt,svg,canvas,[role="button"],[contenteditable="true"],#fudoki-reader-rail-host,.fudoki-popup,.fudoki-inline-wrap';
  return !!(element.closest && element.closest(blocked));
}

function isInteractiveContent(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('a,button,input,textarea,select,summary,label,[role="button"],[role="link"],[contenteditable="true"],nav,menu');
}

function isFudokiUi(target) {
  if (!target) return false;
  const root = target.getRootNode && target.getRootNode();
  return root && root.host && root.host.id === 'fudoki-reader-rail-host' ||
    !!(target.closest && target.closest('#fudoki-reader-rail-host,.fudoki-popup'));
}

function findSentenceForNode(node) {
  const block = node.closest(BLOCK_SELECTOR);
  const source = getCleanBlockSource(block, node);
  const text = source.text;
  if (!text) return '';

  const surface = node.dataset.surface || '';
  const position = source.position >= 0
    ? source.position
    : Math.max(0, surface ? text.indexOf(surface) : 0);

  return extractSentenceAt(text, position, 220);
}

function getCleanBlockSource(block, targetNode = null, targetOffset = 0) {
  if (!block) return { text: '', position: -1 };

  let text = '';
  let position = -1;

  const visit = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetNode) {
        const offset = Math.max(0, Math.min(targetOffset || 0, (node.nodeValue || '').length));
        position = text.length + offset;
      }
      text += node.nodeValue || '';
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node;

    if (element.classList.contains('fudoki-inline-wrap')) {
      const originalText = getInlineWrapperSource(element);
      if (targetNode && (element === targetNode || element.contains(targetNode))) {
        position = text.length + getInlineWrapperOffset(element, targetNode, targetOffset);
      }
      text += originalText;
      return;
    }

    if (element.matches(
      'rt,script,style,noscript,.fudoki-inline-meaning,.fudoki-sentence-translation,' +
      '#fudoki-reader-rail-host,.fudoki-popup'
    )) {
      return;
    }

    if (element.tagName === 'BR') {
      text += '\n';
      return;
    }

    Array.from(element.childNodes).forEach(visit);
  };

  visit(block);
  return { text, position };
}

function getInlineWrapperSource(wrapper) {
  if (typeof wrapper.dataset.originalText === 'string') {
    return wrapper.dataset.originalText;
  }

  return Array.from(wrapper.childNodes)
    .map((child) => getInlineChildSource(child))
    .join('');
}

function getInlineWrapperOffset(wrapper, targetNode, targetOffset = 0) {
  const targetElement = targetNode?.nodeType === Node.ELEMENT_NODE
    ? targetNode
    : targetNode?.parentElement;
  const token = targetElement?.closest?.('.fudoki-inline-token');

  if (token && wrapper.contains(token)) {
    const storedOffset = Number(token.dataset.sourceStart);
    if (Number.isFinite(storedOffset)) return storedOffset;
  }

  let offset = 0;
  const children = Array.from(wrapper.childNodes);

  if (targetNode === wrapper) {
    return children
      .slice(0, Math.max(0, Math.min(targetOffset || 0, children.length)))
      .reduce((total, child) => total + getInlineChildSource(child).length, 0);
  }

  for (const child of children) {
    if (child === targetNode) {
      const childText = getInlineChildSource(child);
      return offset + Math.max(0, Math.min(targetOffset || 0, childText.length));
    }
    if (child.nodeType === Node.ELEMENT_NODE && child.contains(targetNode)) {
      return offset;
    }
    offset += getInlineChildSource(child).length;
  }

  return 0;
}

function getInlineChildSource(child) {
  if (child.nodeType === Node.TEXT_NODE) return child.nodeValue || '';
  if (child.nodeType !== Node.ELEMENT_NODE) return '';
  if (child.classList.contains('fudoki-inline-token')) {
    return child.dataset.surface || '';
  }
  return child.textContent || '';
}

function extractSentenceAt(text, position, maxLength = 220) {
  if (!text) return '';

  const sentenceMarks = ['。', '！', '？', '.', '!', '?', '\n'];
  const safePosition = Math.max(0, Math.min(Number.isFinite(position) ? position : 0, text.length));
  const previousPosition = Math.max(0, safePosition - 1);
  const start = Math.max(
    ...sentenceMarks.map((mark) => text.lastIndexOf(mark, previousPosition))
  ) + 1;
  const endings = sentenceMarks
    .map((mark) => text.indexOf(mark, safePosition))
    .filter((index) => index >= 0);
  const end = endings.length
    ? Math.min(...endings) + 1
    : Math.min(text.length, start + maxLength);

  return text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
}

async function showSentenceTranslation(sentence, anchor) {
  if (!inlineState.sentenceConsent) {
    const ok = window.confirm(uiText('sentenceConsent'));
    if (!ok) return;
    inlineState.sentenceConsent = true;
  }

  removeSentenceTranslations();
  const bubble = document.createElement('span');
  bubble.className = 'fudoki-sentence-translation';
  bubble.textContent = uiText('translating');
  anchor.appendChild(bubble);

  try {
    const response = await safeRuntimeSendMessage({
      type: 'TRANSLATE_TEXT',
      text: sentence,
      targetLang: settings.fudoki_translate_target || 'zh-CN'
    });
    bubble.textContent = response && response.success ? response.data : uiText('translationFailed');
  } catch (error) {
    bubble.textContent = uiText('translationFailed');
  }
}

function closeFloatingUi() {
  closeRail();
  removeSentenceTranslations();
}

function closeRail() {
  const host = document.getElementById('fudoki-reader-rail-host');
  const rail = host?.shadowRoot?.querySelector('.rail');
  if (rail) rail.classList.remove('open');
}

function removeSentenceTranslations() {
  document.querySelectorAll('.fudoki-sentence-translation').forEach((bubble) => bubble.remove());
}

function openWise(amount) {
  if (FUDOKI_WISE_TAG_URL.includes('REPLACE_WITH_')) {
    alert('Wise link is not configured.');
    return;
  }
  const url = new URL(FUDOKI_WISE_TAG_URL);
  if (amount && amount !== 'custom') {
    url.searchParams.set('amount', amount);
    url.searchParams.set('currency', 'USD');
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function openConfiguredUrl(url, fallbackMessage) {
  if (url.includes('REPLACE_WITH_')) {
    alert(fallbackMessage);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function removePopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
}

function handleSelection(event) {
  if (currentPopup && event && currentPopup.contains(event.target)) return;
  if (isFudokiUi(event.target)) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();
  if (!text || !JAPANESE_RE.test(text)) return;
  if (currentPopup && currentPopup.contains(selection.anchorNode)) return;

  removePopup();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const sentenceText = getSentenceForSelection(selection, text);
  showPopup(text, window.scrollX + rect.left, window.scrollY + rect.bottom + 10, sentenceText);
}

function getSentenceForSelection(selection, selectedText) {
  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  const container = range?.startContainer?.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement
    : range?.startContainer;
  const block = container?.closest?.(BLOCK_SELECTOR);
  const source = getCleanBlockSource(block, range?.startContainer, range?.startOffset || 0);
  const blockText = source.text;
  const selectionText = selectedText.replace(/\s+/g, ' ').trim();

  if (!blockText || !selectionText) {
    return selectedText;
  }

  if (source.position >= 0) {
    return extractSentenceAt(blockText, source.position, 220) || selectedText;
  }

  if (selectionText.length > 80) return selectedText;

  const index = blockText.indexOf(selectionText);
  if (index < 0) return selectedText;

  const sentence = extractSentenceAt(blockText, index, 220);

  return sentence && sentence.length >= selectionText.length ? sentence : selectedText;
}

async function showPopup(text, x, y, translationText = text) {
  removePopup();

  currentPopup = document.createElement('div');
  currentPopup.className = 'fudoki-popup fudoki-reader-popup';
  currentPopup.addEventListener('mouseup', (event) => event.stopPropagation());
  currentPopup.addEventListener('mousedown', (event) => event.stopPropagation());
  currentPopup.addEventListener('click', (event) => event.stopPropagation());

  if (shouldUseDarkTheme()) {
    currentPopup.classList.add('fudoki-theme-dark');
  }

  currentPopup.style.left = `${x}px`;
  currentPopup.style.top = `${y}px`;
  currentPopup.innerHTML = `
    <div class="fudoki-loading">
      <div class="fudoki-spinner"></div>
      <span>${uiText('analyzing')}</span>
    </div>
  `;

  document.body.appendChild(currentPopup);
  adjustPopupPosition();

  let tokens = [];
  try {
    const response = await safeRuntimeSendMessage({ type: 'ANALYZE_REQUEST', text });
    if (response && response.success && Array.isArray(response.data)) {
      tokens = response.data;
    }
  } catch (error) {
    console.warn('Fudoki selection analysis failed:', error);
  }

  if (!currentPopup) return;
  renderSelectionReader(tokens, text, translationText);
  adjustPopupPosition();
}

function renderSelectionReader(tokens, originalText, translationText) {
  const tokenList = tokens.length ? tokens : [{ surface: originalText, hiragana: '', reading: '', romaji: '', pos: [] }];
  const reading = tokenList.map((token) => token.hiragana || token.reading || token.surface).join('');
  const tokenHtml = tokenList.map((token, index) => renderSelectionToken(token, index)).join('');
  const speed = parseFloat(settings.fudoki_tts_speed) || 1.0;

  currentPopup.innerHTML = `
    <div class="fudoki-content fudoki-reader-content">${tokenHtml}</div>
    <div class="fudoki-translation" id="fudoki-translation-result" style="display:none;"></div>
    <div class="fudoki-speed-row">
      <span>${uiText('speed')}</span>
      <input type="range" id="fudoki-speed-range" min="0.1" max="1.5" step="0.1" value="${speed}">
      <span id="fudoki-speed-val">${speed.toFixed(1)}x</span>
    </div>
    <div class="fudoki-popup-actions">
      <button class="fudoki-btn" id="fudoki-prev-btn" title="${uiText('previousWord')}" aria-label="${uiText('previousWord')}">
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
      </button>
      <button class="fudoki-btn fudoki-emoji-btn" id="fudoki-play-btn" title="${uiText('readAloud')}" aria-label="${uiText('readAloud')}">
        🗣️
      </button>
      <button class="fudoki-btn" id="fudoki-next-btn" title="${uiText('nextWord')}" aria-label="${uiText('nextWord')}">
        <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-translate-btn" title="${uiText('translate')}" aria-label="${uiText('translate')}">
        <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-restart-btn" title="${uiText('restart')}" aria-label="${uiText('restart')}">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </button>
      <button class="fudoki-btn" id="fudoki-vocab-btn" title="${uiText('save')}" aria-label="${uiText('save')}">
        <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
      </button>
    </div>
  `;

  bindSelectionReaderControls(tokenList, originalText, reading, translationText);
}

function renderSelectionToken(token, index) {
  const tokenReading = getTokenReading(token);
  const pos = getPosMeta(token);
  const hasKanji = KANJI_RE.test(token.surface || '');
  return `
    <div class="fudoki-token fudoki-reader-token" data-token-index="${index}">
      ${tokenReading && (hasKanji || inlineState.readingMode === 'romaji') ? `<div class="fudoki-reading">${escapeHtml(tokenReading)}</div>` : '<div class="fudoki-reading empty"></div>'}
      <div class="fudoki-surface">${escapeHtml(token.surface || '')}</div>
      <div class="fudoki-pos-bar ${pos.className}"></div>
      <div class="fudoki-pos-label">${escapeHtml(pos.label)}</div>
    </div>
  `;
}

function bindSelectionReaderControls(tokens, originalText, reading, translationText) {
  const playBtn = currentPopup.querySelector('#fudoki-play-btn');
  const prevBtn = currentPopup.querySelector('#fudoki-prev-btn');
  const nextBtn = currentPopup.querySelector('#fudoki-next-btn');
  const restartBtn = currentPopup.querySelector('#fudoki-restart-btn');
  const translateBtn = currentPopup.querySelector('#fudoki-translate-btn');
  const vocabBtn = currentPopup.querySelector('#fudoki-vocab-btn');
  const speedRange = currentPopup.querySelector('#fudoki-speed-range');
  const speedVal = currentPopup.querySelector('#fudoki-speed-val');
  const vocabIcon = vocabBtn.innerHTML;
  const playIcon = '🗣️';
  const pauseIcon = '⏸️';
  const boundaries = buildTokenBoundaries(tokens, originalText);
  let currentTokenIndex = 0;

  function rate() {
    return parseFloat(speedRange.value) || 1.0;
  }

  function updateHighlight(charIndex) {
    clearTokenHighlights();
    const tokenIndex = boundaries.findIndex((item) => charIndex >= item.start && charIndex < item.end);
    if (tokenIndex >= 0) {
      highlightToken(tokenIndex);
      currentTokenIndex = tokenIndex;
    }
  }

  function onStart() {
    playBtn.innerHTML = pauseIcon;
  }

  function onEnd() {
    playBtn.innerHTML = playIcon;
    clearTokenHighlights();
    currentTokenIndex = 0;
  }

  function playFrom(index) {
    currentTokenIndex = Math.max(0, Math.min(index, tokens.length - 1));
    const start = boundaries[currentTokenIndex]?.start || 0;
    SpeechController.play(
      originalText.slice(start),
      rate(),
      onStart,
      onEnd,
      (event) => updateHighlight((event.charIndex || 0) + start)
    );
  }

  speedRange.addEventListener('input', () => {
    speedVal.textContent = `${rate().toFixed(1)}x`;
  });
  speedRange.addEventListener('change', () => {
    settings.fudoki_tts_speed = rate();
    safeStorageSet({ fudoki_tts_speed: settings.fudoki_tts_speed });
  });
  playBtn.addEventListener('click', () => {
    const state = SpeechController.toggle(
      originalText,
      rate(),
      onStart,
      onEnd,
      (event) => updateHighlight(event.charIndex || 0)
    );
    if (state === 'paused') playBtn.innerHTML = playIcon;
    if (state === 'resumed') playBtn.innerHTML = pauseIcon;
  });
  restartBtn.addEventListener('click', () => playFrom(0));
  prevBtn.addEventListener('click', () => {
    currentTokenIndex = Math.max(0, currentTokenIndex - 1);
    highlightToken(currentTokenIndex);
    SpeechController.play(tokens[currentTokenIndex]?.surface || '', rate(), null, null, null);
  });
  nextBtn.addEventListener('click', () => {
    currentTokenIndex = Math.min(tokens.length - 1, currentTokenIndex + 1);
    highlightToken(currentTokenIndex);
    SpeechController.play(tokens[currentTokenIndex]?.surface || '', rate(), null, null, null);
  });
  translateBtn.addEventListener('click', () => {
    loadSelectionTranslation(translationText || originalText, translateBtn);
  });
  vocabBtn.addEventListener('click', () => {
    vocabBtn.disabled = true;
    const translationEl = currentPopup.querySelector('#fudoki-translation-result');
    addToVocabulary({
      word: originalText,
      reading,
      context: originalText,
      tokens,
      translation: translationEl && translationEl.style.display !== 'none' ? translationEl.textContent : ''
    }, vocabBtn, vocabIcon);
  });
}

async function loadSelectionTranslation(text, button) {
  const translationEl = currentPopup?.querySelector('#fudoki-translation-result');
  if (!translationEl || settings.fudoki_translate_target === 'none') {
    if (translationEl) translationEl.textContent = '';
    return;
  }

  translationEl.style.display = 'block';
  translationEl.textContent = uiText('translating');
  if (button) {
    button.disabled = true;
    button.classList.add('loading');
  }

  const response = await safeRuntimeSendMessage({
    type: 'TRANSLATE_TEXT',
    text,
    targetLang: settings.fudoki_translate_target || 'zh-CN'
  });
  if (!currentPopup || !translationEl.isConnected) return;
  translationEl.textContent = response && response.success
    ? uiText('sentenceResult', { text: response.data })
    : uiText('translationFailed');
  if (button && button.isConnected) {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

function buildTokenBoundaries(tokens, originalText = '') {
  let cursor = 0;
  return tokens.map((token) => {
    const surface = token.surface || '';
    let start = originalText.indexOf(surface, cursor);
    if (start < 0) start = cursor;
    const end = start + surface.length;
    cursor = end;
    return { start, end: cursor };
  });
}

function getTokenReading(token) {
  const mode = normalizeReadingMode(settings.fudoki_reading_mode || inlineState.readingMode);
  if (mode === 'katakana') return token.reading || token.hiragana || '';
  if (mode === 'romaji') return token.romaji || token.hiragana || '';
  return token.hiragana || token.reading || '';
}

function getPosMeta(token) {
  const pos = token.pos && token.pos[0];
  if (pos === '名詞') return { label: uiText('posNoun'), className: 'pos-noun' };
  if (pos === '動詞') return { label: uiText('posVerb'), className: 'pos-verb' };
  if (pos === '形容詞') return { label: uiText('posAdjective'), className: 'pos-adj' };
  if (pos === '副詞') return { label: uiText('posAdverb'), className: 'pos-adv' };
  if (pos === '助詞') return { label: uiText('posParticle'), className: 'pos-particle' };
  if (pos === '助動詞') return { label: uiText('posAuxiliary'), className: 'pos-aux' };
  if (pos === '接続詞') return { label: uiText('posConjunction'), className: 'pos-conj' };
  if (pos === '連体詞') return { label: uiText('posAdnominal'), className: 'pos-adn' };
  if (pos === '感動詞') return { label: uiText('posInterjection'), className: 'pos-int' };
  return { label: '', className: '' };
}

function clearTokenHighlights() {
  currentPopup?.querySelectorAll('.fudoki-reader-token').forEach((token) => {
    token.classList.remove('fudoki-highlight');
  });
}

function highlightToken(index) {
  clearTokenHighlights();
  currentPopup?.querySelector(`[data-token-index="${index}"]`)?.classList.add('fudoki-highlight');
}

function adjustPopupPosition() {
  if (!currentPopup) return;
  const rect = currentPopup.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    currentPopup.style.left = `${Math.max(10, window.innerWidth - rect.width - 10)}px`;
  }
  if (rect.bottom > window.innerHeight) {
    currentPopup.style.top = `${Math.max(window.scrollY + 10, window.scrollY + window.innerHeight - rect.height - 10)}px`;
  }
}

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  let voice = voices.find((item) => item.name.includes('Kyoko'));
  if (!voice) {
    voice = voices.find((item) => item.lang.toLowerCase().startsWith('ja'));
  }
  return voice;
}

const SpeechController = {
  utterance: null,
  isPaused: false,
  isPlaying: false,

  play(text, rate, onStart, onEnd, onBoundary) {
    this.stop();
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
    this.utterance.onerror = () => {
      this.isPlaying = false;
      this.isPaused = false;
      if (onEnd) onEnd();
    };

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
      }
      this.pause();
      return 'paused';
    }
    this.play(text, rate, onStart, onEnd, onBoundary);
    return 'started';
  }
};

function addToVocabulary(data, btnElement, originalIcon) {
  safeStorageGet(['fudoki_vocabulary', 'fudoki_language'], (result) => {
    if (!result) {
      showButtonMessage(btnElement, 'Reload page', originalIcon);
      return;
    }
    const vocabulary = result.fudoki_vocabulary || [];
    const lang = result.fudoki_language || 'zh';
    const messages = {
      en: { existed: 'Saved', added: 'Added' },
      zh: { existed: '已收藏', added: '已收藏' },
      ja: { existed: '保存済', added: '保存済' }
    };
    const msg = messages[lang] || messages.zh;

    if (vocabulary.some((item) => item.word === data.word)) {
      showButtonMessage(btnElement, msg.existed, originalIcon);
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
      nextReview: Date.now(),
      level: 0
    };

    safeStorageSet({ fudoki_vocabulary: vocabulary.concat(newItem) }, () => {
      showButtonMessage(btnElement, msg.added, originalIcon);
    });
  });
}

function showButtonMessage(button, message, originalIcon) {
  button.disabled = false;
  button.classList.add('fudoki-btn-message');
  button.innerHTML = `<span class="fudoki-btn-text">${escapeHtml(message)}</span>`;
  setTimeout(() => {
    if (button.isConnected) {
      button.innerHTML = originalIcon;
      button.classList.remove('fudoki-btn-message');
      button.disabled = false;
    }
  }, 1300);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

function safeStorageGet(keys, callback) {
  if (!isExtensionContextValid()) {
    callback(null);
    return;
  }
  try {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        callback(null);
        return;
      }
      callback(result);
    });
  } catch (error) {
    callback(null);
  }
}

function safeStorageSet(values, callback) {
  if (!isExtensionContextValid()) {
    if (callback) callback(false);
    return;
  }
  try {
    chrome.storage.local.set(values, () => {
      if (callback) callback(!chrome.runtime.lastError);
    });
  } catch (error) {
    if (callback) callback(false);
  }
}

async function safeRuntimeSendMessage(message) {
  if (!isExtensionContextValid()) {
    return { success: false, error: 'Extension context invalidated' };
  }
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {};
}

if (window.matchMedia) {
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeQuery.addEventListener?.('change', () => {
    if (settings.fudoki_theme === 'system') updateContentTheme();
  });
}
