const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createClassList(classes = []) {
  const values = new Set(classes);
  return {
    contains(value) {
      return values.has(value);
    }
  };
}

function createElement(tagName, classes = [], children = [], dataset = {}) {
  const element = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    classList: createClassList(classes),
    childNodes: children,
    dataset,
    parentElement: null,
    matches(selector) {
      return selector.split(',').some((part) => {
        const value = part.trim();
        if (value.startsWith('.')) return this.classList.contains(value.slice(1));
        if (value.startsWith('#')) return this.id === value.slice(1);
        return this.tagName.toLowerCase() === value;
      });
    },
    contains(target) {
      return this === target || this.childNodes.some((child) => (
        child === target ||
        (child.nodeType === 1 && child.contains(target))
      ));
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (current.matches(selector)) return current;
        current = current.parentElement;
      }
      return null;
    }
  };

  children.forEach((child) => {
    child.parentElement = element;
  });
  return element;
}

function createContext() {
  const context = {
    chrome: {
      runtime: {
        id: 'test',
        getURL: (value) => value,
        lastError: null,
        onMessage: { addListener() {} },
        sendMessage: async () => ({ success: true })
      },
      storage: {
        local: {
          get() {},
          set(_values, callback) {
            callback?.();
          }
        }
      }
    },
    console,
    document: {
      addEventListener() {},
      body: null,
      documentElement: { lang: '' },
      querySelectorAll: () => []
    },
    Node: {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3
    },
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    window: {
      matchMedia: null,
      speechSynthesis: null
    }
  };

  vm.createContext(context);
  const contentPath = path.join(__dirname, '..', 'extension', 'content.js');
  vm.runInContext(fs.readFileSync(contentPath, 'utf8'), context);
  return context;
}

const context = createContext();

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

test('extracts the complete original sentence instead of an annotated reading', () => {
  const sentence = '静かになった町のどこかで、神様もきっと、それくらいがちょうどいいのだと言っているのでしょう。';
  context.testSentence = sentence;

  assert.equal(
    evaluate('extractSentenceAt(testSentence, 0, 220)'),
    sentence
  );
});

test('uses the clicked occurrence when a word appears in multiple sentences', () => {
  const text = '祭りは終わった。来年の祭りも楽しみです。';
  context.repeatedSentenceText = text;
  context.repeatedSentenceOffset = text.lastIndexOf('祭り');

  assert.equal(
    evaluate('extractSentenceAt(repeatedSentenceText, repeatedSentenceOffset, 220)'),
    '来年の祭りも楽しみです。'
  );
});

test('reconstructs clean source text from an annotated wrapper', () => {
  const sentence = '静かになった町で、静かに待つ。';
  const firstToken = createElement(
    'span',
    ['fudoki-inline-token'],
    [],
    { surface: '静か', sourceStart: '0' }
  );
  const secondToken = createElement(
    'span',
    ['fudoki-inline-token'],
    [],
    { surface: '静か', sourceStart: String(sentence.lastIndexOf('静か')) }
  );
  const wrapper = createElement(
    'span',
    ['fudoki-inline-wrap'],
    [firstToken, secondToken],
    { originalText: sentence }
  );
  const block = createElement('p', [], [wrapper]);
  context.testBlock = block;
  context.testSecondToken = secondToken;

  const result = evaluate('getCleanBlockSource(testBlock, testSecondToken)');

  assert.equal(result.text, sentence);
  assert.equal(result.position, sentence.lastIndexOf('静か'));
  context.testCleanText = result.text;
  context.testCleanPosition = result.position;
  assert.equal(
    evaluate('extractSentenceAt(testCleanText, testCleanPosition, 220)'),
    '静かになった町で、静かに待つ。'
  );
});

test('selection translation ignores ruby text included in the browser selection', () => {
  const sentence = '静かになった町のどこかで、神様もきっと見守っているのでしょう。';
  const token = createElement(
    'span',
    ['fudoki-inline-token'],
    [],
    { surface: '静か', sourceStart: '0' }
  );
  const wrapper = createElement(
    'span',
    ['fudoki-inline-wrap'],
    [token],
    { originalText: sentence }
  );
  createElement('p', [], [wrapper]);

  context.testSelection = {
    rangeCount: 1,
    getRangeAt() {
      return {
        startContainer: token,
        startOffset: 0
      };
    }
  };
  context.pollutedSelectionText = '静かしずか';

  assert.equal(
    evaluate('getSentenceForSelection(testSelection, pollutedSelectionText)'),
    sentence
  );
});
