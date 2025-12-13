(function() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("fudoki_pending_text", (result) => {
      if (result.fudoki_pending_text) {
        const text = result.fudoki_pending_text;
        
        // Logic to create new document
        const LS_TEXTS = 'texts';
        const LS_ACTIVE_ID = 'activeId';
        
        let docs = [];
        try {
          docs = JSON.parse(localStorage.getItem(LS_TEXTS) || '[]');
        } catch (e) {
          docs = [];
        }
        
        const newId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newDoc = {
          id: newId,
          content: text,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          locked: false
        };
        
        docs.push(newDoc);
        localStorage.setItem(LS_TEXTS, JSON.stringify(docs));
        localStorage.setItem(LS_ACTIVE_ID, newId);
        
        // Clear pending text
        chrome.storage.local.remove("fudoki_pending_text");
        
        console.log("Imported text from extension context menu");
      }
    });
  }
})();
