document.addEventListener('DOMContentLoaded', () => {
  const listContainer = document.getElementById('vocab-list');
  const emptyState = document.getElementById('empty-state');
  const dueCountEl = document.getElementById('due-count');
  const tabs = document.querySelectorAll('.tab-btn');
  
  let currentTab = 'review'; // 'review' or 'all'
  let vocabulary = [];

  // SRS Intervals (in milliseconds)
  const INTERVALS = [
    0,
    24 * 60 * 60 * 1000,       // 1 day
    3 * 24 * 60 * 60 * 1000,   // 3 days
    7 * 24 * 60 * 60 * 1000,   // 7 days
    14 * 24 * 60 * 60 * 1000,  // 14 days
    30 * 24 * 60 * 60 * 1000,  // 30 days
    90 * 24 * 60 * 60 * 1000   // 90 days
  ];

  // Load vocabulary
  function loadVocabulary() {
    chrome.storage.local.get(['fudoki_vocabulary'], (result) => {
      vocabulary = result.fudoki_vocabulary || [];
      updateStats();
      renderList();
    });
  }

  function saveVocabulary() {
    chrome.storage.local.set({ fudoki_vocabulary: vocabulary }, () => {
      updateStats();
      renderList();
    });
  }

  function updateStats() {
    const now = Date.now();
    const dueCount = vocabulary.filter(item => item.nextReview <= now).length;
    dueCountEl.textContent = dueCount;
  }

  function renderList() {
    listContainer.innerHTML = '';
    const now = Date.now();
    
    let items = [];
    if (currentTab === 'review') {
      items = vocabulary.filter(item => item.nextReview <= now);
    } else {
      items = [...vocabulary].sort((a, b) => b.addedAt - a.addedAt);
    }

    if (items.length === 0) {
      emptyState.style.display = 'flex';
      listContainer.style.display = 'none';
      
      if (currentTab === 'review' && vocabulary.length > 0) {
        emptyState.querySelector('p').textContent = "All caught up!";
        emptyState.querySelector('.sub-text').textContent = "No words due for review right now.";
      } else {
        emptyState.querySelector('p').textContent = "No words found.";
        emptyState.querySelector('.sub-text').textContent = "Select text on any page to add words.";
      }
      return;
    }

    emptyState.style.display = 'none';
    listContainer.style.display = 'block';

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'vocab-item';
      
      const isDue = item.nextReview <= now;
      const nextReviewDate = new Date(item.nextReview).toLocaleDateString();
      
      let contentHtml = '';
      if (item.tokens && item.tokens.length > 0) {
        contentHtml = '<div class="vocab-tokens">';
        item.tokens.forEach(token => {
          const reading = token.hiragana || token.reading || '';
          const hasKanji = /[\u4e00-\u9faf]/.test(token.surface);
          const showReading = hasKanji && reading && reading !== token.surface;
          
          let posClass = '';
          let posLabel = '';
          if (token.pos && token.pos[0]) {
            const pos = token.pos[0];
            if (pos === '名詞') { posClass = 'pos-noun'; posLabel = '名'; }
            else if (pos === '動詞') { posClass = 'pos-verb'; posLabel = '動'; }
            else if (pos === '形容詞') { posClass = 'pos-adj'; posLabel = '形'; }
            else if (pos === '副詞') { posClass = 'pos-adv'; posLabel = '副'; }
            else if (pos === '助詞') { posClass = 'pos-particle'; posLabel = '助'; }
            else if (pos === '助動詞') { posClass = 'pos-aux'; posLabel = '助動'; }
            else if (pos === '接続詞') { posClass = 'pos-conj'; posLabel = '接'; }
            else if (pos === '連体詞') { posClass = 'pos-adn'; posLabel = '連'; }
            else if (pos === '感動詞') { posClass = 'pos-int'; posLabel = '感'; }
            else { posLabel = '&nbsp;'; }
          }

          contentHtml += `
            <div class="vocab-token">
              <div class="vocab-token-reading">${showReading ? reading : '&nbsp;'}</div>
              <div class="vocab-token-surface">${token.surface}</div>
              ${posClass ? `
                <div class="vocab-token-pos ${posClass}"></div>
                <div class="vocab-token-pos-label">${posLabel}</div>
              ` : ''}
            </div>
          `;
        });
        contentHtml += '</div>';
      } else {
        contentHtml = `
          <div>
            <span class="vocab-word">${item.word}</span>
            <span class="vocab-reading">${item.reading || ''}</span>
          </div>
        `;
      }

      el.innerHTML = `
        <div class="vocab-word-row">
          <div class="vocab-main-content">
            ${contentHtml}
            ${item.translation ? `<div class="vocab-translation">${item.translation}</div>` : ''}
          </div>
          <button class="btn btn-delete" title="Delete">✕</button>
        </div>
        ${item.context && item.context !== item.word ? `<div class="vocab-context">${item.context}</div>` : ''}
        <div class="vocab-meta">
          <span class="vocab-level">Level ${item.level} • Due: ${isDue ? 'Now' : nextReviewDate}</span>
          <div class="vocab-actions">
            ${isDue ? `
              <button class="btn btn-forgot">Forgot</button>
              <button class="btn btn-remember">Remember</button>
            ` : ''}
          </div>
        </div>
      `;

      // Event Listeners
      el.querySelector('.btn-delete').addEventListener('click', () => deleteItem(item.id));
      
      if (isDue) {
        el.querySelector('.btn-forgot').addEventListener('click', () => processReview(item.id, false));
        el.querySelector('.btn-remember').addEventListener('click', () => processReview(item.id, true));
      }

      listContainer.appendChild(el);
    });
  }

  function deleteItem(id) {
    if (confirm('Delete this word?')) {
      vocabulary = vocabulary.filter(item => item.id !== id);
      saveVocabulary();
    }
  }

  function processReview(id, remembered) {
    const index = vocabulary.findIndex(item => item.id === id);
    if (index === -1) return;

    const item = vocabulary[index];
    
    if (remembered) {
      item.level = Math.min(item.level + 1, INTERVALS.length - 1);
    } else {
      item.level = Math.max(0, item.level - 1); // Or reset to 0? Let's just decrease for now.
      if (!remembered) item.level = 0; // Actually, standard SRS resets to 0 on fail
    }

    const interval = INTERVALS[item.level];
    item.nextReview = Date.now() + interval;
    
    saveVocabulary();
  }

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderList();
    });
  });

  // Initial load
  loadVocabulary();
});
