/**
 * Pure frontend Japanese segmentation and reading processing module
 * Replaces the original Python backend SudachiPy functionality
 */

class JapaneseSegmenter {
  constructor() {
    this.kuromoji = null;
    this.kuroshiro = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Wait a short time to ensure scripts are loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if global variables are already loaded
      if (typeof window.kuromoji !== 'undefined' && typeof window.Kuroshiro !== 'undefined' && typeof window.KuromojiAnalyzer !== 'undefined') {
        console.log('Initializing tokenizer using global variables...');
        
        // Use relative path for dictionary
        const dicPath = 'static/libs/dict/';
        
        // Initialize kuromoji tokenizer
        try {
          this.kuromoji = await new Promise((resolve, reject) => {
            window.kuromoji.builder({ dicPath: dicPath }).build((err, tokenizer) => {
              if (err) reject(err);
              else resolve(tokenizer);
            });
          });
        } catch (e) {
          console.error('Kuromoji initialization failed:', e);
          throw e; // Critical failure
        }
        
        // Initialize Kuroshiro (optional, for conversion utils)
        try {
          // Check if Kuroshiro is a constructor or an instantiated object
          if (typeof window.Kuroshiro === 'function') {
            this.kuroshiro = new window.Kuroshiro();
          } else if (window.Kuroshiro && typeof window.Kuroshiro.init === 'function') {
            this.kuroshiro = window.Kuroshiro;
          } else if (window.Kuroshiro && window.Kuroshiro.default) {
            this.kuroshiro = new window.Kuroshiro.default();
          } else {
            // Fallback for unknown type
            this.kuroshiro = new window.Kuroshiro();
          }
          
          const analyzer = new window.KuromojiAnalyzer({
            dictPath: dicPath
          });
          
          await this.kuroshiro.init(analyzer);
        } catch (e) {
          console.warn('Kuroshiro initialization failed (continuing with Kuromoji only):', e);
          // Do not throw, as we can still segment with this.kuromoji
        }

        this.initialized = true;
        console.log('Japanese segmentation library loaded');
        return;
      }

      // If global variables do not exist, try to dynamically import local resources
      console.log('Loading Japanese segmentation library...');
      const kuromojiModule = await import('/static/libs/kuromoji.js');
      const Kuroshiro = (await import('/static/libs/kuroshiro.min.js')).default;
      const KuromojiAnalyzer = (await import('/static/libs/kuroshiro-analyzer-kuromoji.min.js')).default;

      const dicPath = 'static/libs/dict/';

      // Initialize kuromoji tokenizer
      try {
        this.kuromoji = await new Promise((resolve, reject) => {
          // kuromoji.js usually sets window.kuromoji
          const k = window.kuromoji || kuromojiModule;
          if (k && k.builder) {
            k.builder({ dicPath: dicPath }).build((err, tokenizer) => {
              if (err) reject(err);
              else resolve(tokenizer);
            });
          } else {
            reject(new Error("Kuromoji builder not found"));
          }
        });
      } catch (e) {
        console.error('Kuromoji initialization failed:', e);
        throw e;
      }

      // Initialize Kuroshiro
      try {
        this.kuroshiro = new Kuroshiro();
        await this.kuroshiro.init(new KuromojiAnalyzer({ dictPath: dicPath }));
      } catch (e) {
        console.warn('Kuroshiro initialization failed (continuing with Kuromoji only):', e);
      }
      
      this.initialized = true;
      console.log('Japanese segmentation library loaded');
    } catch (error) {
      console.error('Failed to initialize Japanese segmenter:', error);
      // Provide simplified segmentation as a fallback
      this.initialized = true;
      this.fallbackMode = true;
      console.log('Using simplified segmentation mode');
    }
  }

  /**
   * Year reading processing - corresponds to the original Python year_reading function
   */
  yearReading(num) {
    if (num < 1000 || num > 9999) {
      return String(num);
    }

    const d_th = Math.floor(num / 1000);
    const d_h = Math.floor((num / 100) % 10);
    const d_t = Math.floor((num / 10) % 10);
    const d_o = num % 10;

    const one = {
      0: "", 1: "いち", 2: "に", 3: "さん", 4: "よん", 5: "ご", 
      6: "ろく", 7: "なな", 8: "はち", 9: "きゅう"
    };

    const th_map = {
      1: "せん", 2: "にせん", 3: "さんぜん", 4: "よんせん", 5: "ごせん",
      6: "ろくせん", 7: "ななせん", 8: "はっせん", 9: "きゅうせん"
    };

    const h_map = {
      0: "", 1: "ひゃく", 2: "にひゃく", 3: "さんびゃく", 4: "よんひゃく",
      5: "ごひゃく", 6: "ろっぴゃく", 7: "ななひゃく", 8: "はっぴゃく", 9: "きゅうひゃく"
    };

    const t_map = {
      0: "", 1: "じゅう", 2: "にじゅう", 3: "さんじゅう", 4: "よんじゅう",
      5: "ごじゅう", 6: "ろくじゅう", 7: "ななじゅう", 8: "はちじゅう", 9: "きゅうじゅう"
    };

    const parts = [
      th_map[d_th] || "",
      h_map[d_h] || "",
      t_map[d_t] || "",
      one[d_o] || ""
    ];
    
    return parts.filter(p => p).join('');
  }

  /**
   * General number reading (0 and above, supports up to ten thousand)
   */
  numberReading(num) {
    if (typeof num !== 'number' || !isFinite(num)) return String(num);
    num = Math.floor(Math.abs(num));
    if (num === 0) return 'ゼロ';

    const one = {
      0: '', 1: 'いち', 2: 'に', 3: 'さん', 4: 'よん', 5: 'ご',
      6: 'ろく', 7: 'なな', 8: 'はち', 9: 'きゅう'
    };

    const th_map = {
      0: '', 1: 'せん', 2: 'にせん', 3: 'さんぜん', 4: 'よんせん', 5: 'ごせん',
      6: 'ろくせん', 7: 'ななせん', 8: 'はっせん', 9: 'きゅうせん'
    };

    const h_map = {
      0: '', 1: 'ひゃく', 2: 'にひゃく', 3: 'さんびゃく', 4: 'よんひゃく',
      5: 'ごひゃく', 6: 'ろっぴゃく', 7: 'ななひゃく', 8: 'はっぴゃく', 9: 'きゅうひゃく'
    };

    const t_map = {
      0: '', 1: 'じゅう', 2: 'にじゅう', 3: 'さんじゅう', 4: 'よんじゅう',
      5: 'ごじゅう', 6: 'ろくじゅう', 7: 'ななじゅう', 8: 'はちじゅう', 9: 'きゅうじゅう'
    };

    const buildUnder10000 = (n) => {
      const d_th = Math.floor(n / 1000);
      const d_h = Math.floor((n / 100) % 10);
      const d_t = Math.floor((n / 10) % 10);
      const d_o = n % 10;
      const parts = [th_map[d_th], h_map[d_h], t_map[d_t], one[d_o]];
      return parts.filter(Boolean).join('');
    };

    if (num < 10000) {
      return buildUnder10000(num);
    }

    const man = Math.floor(num / 10000);
    const rest = num % 10000;
    const manPart = buildUnder10000(man) + 'まん';
    const restPart = rest ? buildUnder10000(rest) : '';
    return manPart + restPart;
  }

  /**
   * Special reading for month numbers (1-12)
   * Example: 4月 -> し (+ がつ)
   */
  monthNumberReading(num) {
    const map = {
      1: 'いち', 2: 'に', 3: 'さん', 4: 'し', 5: 'ご',
      6: 'ろく', 7: 'しち', 8: 'はち', 9: 'く', 10: 'じゅう',
      11: 'じゅういち', 12: 'じゅうに'
    };
    return map[num] || '';
  }

  /**
   * English abbreviation reading (A–Z) converted to Katakana by letter name
   * Example: IT -> アイティー, AI -> エーアイ, CPU -> シーピーユー
   */
  englishAbbreviationReading(word) {
    if (!word || typeof word !== 'string') return '';
    // Special case: Common loanwords, read as a word
    // Example: web -> ウェブ (instead of W=ダブリュー, E=イー, B=ビー letter by letter)
    const lower = word.toLowerCase();
    if (lower === 'web') {
      return 'ウェブ';
    }
    const map = {
      'A': 'エー', 'B': 'ビー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
      'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'I': 'アイ', 'J': 'ジェイ',
      'K': 'ケイ', 'L': 'エル', 'M': 'エム', 'N': 'エヌ', 'O': 'オー',
      'P': 'ピー', 'Q': 'キュー', 'R': 'アール', 'S': 'エス', 'T': 'ティー',
      'U': 'ユー', 'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ', 'Z': 'ズィー'
    };
    const chars = word.toUpperCase().split('');
    const parts = [];
    for (const ch of chars) {
      if (map[ch]) parts.push(map[ch]);
      else return word; // Non-pure letters, return original text
    }
    return parts.join('');
  }

  /**
   * Simplified segmentation fallback scheme
   */
  simpleSegment(text) {
    // Simple character-by-character split, used for fallback
    const chars = text.split('');
    const tokens = [];
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (char.trim()) {
        // Assign POS based on character type
        let pos;
        if (/[\u3040-\u309F]/.test(char)) {
          // Hiragana
          pos = ['助詞', '*', '*', '*', '*', '*'];
        } else if (/[\u30A0-\u30FF]/.test(char)) {
          // Katakana
          pos = ['名詞', '一般', '*', '*', '*', '*'];
        } else if (/[\u4E00-\u9FAF]/.test(char)) {
          // Kanji
          pos = ['名詞', '一般', '*', '*', '*', '*'];
        } else if (/[a-zA-Z]/.test(char)) {
          // English letters
          pos = ['名詞', '固有名詞', '一般', '*', '*', '*'];
        } else if (/\d/.test(char)) {
          // Numbers
          pos = ['名詞', '数', '*', '*', '*', '*'];
        } else {
          // Other symbols
          pos = ['記号', '*', '*', '*', '*', '*'];
        }
        
        tokens.push({
          surface: char,
          lemma: char,
          reading: char,
          pos: pos
        });
      }
    }
    
    return tokens;
  }

  /**
   * Segmentation processing - corresponds to the original Python /api/segment interface
   */
  async segment(text, mode = 'B') {
    if (!this.initialized) {
      await this.init();
    }

    if (!text || !text.trim()) {
      return { lines: [] };
    }

    // Split by line, corresponds to original Python logic
    const raw = (text || "").replace(/\r/g, "");
    const parts = raw.split('\n').map(s => s.trim());
    const lines = parts.filter(p => p);
    
    const result = [];
    
    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        result.push([]);
        continue;
      }

      // Remove content in parentheses, corresponds to original Python logic
      const t_for_tok = t.replace(/（.*?）|\(.*?\)/g, '');
      
      try {
        let tokens = [];
        
        if (this.fallbackMode || !this.kuromoji) {
          // Use simplified segmentation
          tokens = this.simpleSegment(t_for_tok);
        } else {
          // Use kuromoji for segmentation
          tokens = this.kuromoji.tokenize(t_for_tok);
        }
        
        const tokenResults = [];

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          const nextToken = tokens[i + 1] || null;
          const surface = token.surface_form || token.surface || '';
          const lemma = token.basic_form || token.lemma || surface;
          let reading = token.__override_reading || token.reading || surface;
          
          // Special handling for 4-digit years
          if (surface.match(/^\d{4}$/)) {
            try {
              const year = parseInt(surface);
              reading = this.yearReading(year);
            } catch (e) {
              // Keep original reading
            }
          }

          // General number (half-width/full-width) reading
          if (/^[0-9０-９]+$/.test(surface)) {
            try {
              const normalized = surface.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
              const num = parseInt(normalized, 10);
              if (!isNaN(num)) {
                reading = this.numberReading(num);
                // If followed by "月", apply special month reading and read "月" as "がつ"
                if (nextToken) {
                  const nextSurface = nextToken.surface_form || nextToken.surface || '';
                  if (nextSurface === '月') {
                    const monthR = this.monthNumberReading(num);
                    if (monthR) {
                      reading = monthR; // Use month reading only for the number part
                      nextToken.__override_reading = 'がつ';
                    }
                  }
                }
              }
            } catch (e) {
              // Keep original reading
            }
          }

          // English abbreviation (pure letters) reading
          if (/^[A-Za-z]+$/.test(surface)) {
            try {
              const katakana = this.englishAbbreviationReading(surface);
              if (katakana && katakana !== surface) {
                reading = katakana;
              }
            } catch (e) {
              // Keep original reading
            }
          }

          // Get POS information
          const pos = token.pos || ['*', '*', '*', '*', '*', '*'];
          
          tokenResults.push({
            surface: surface,
            lemma: lemma,
            reading: reading,
            pos: Array.isArray(pos) ? pos : [pos]
          });
        }

        result.push(tokenResults);
      } catch (error) {
        console.error('Tokenization error:', error);
        // Use simplified segmentation as a last resort
        const simpleTokens = this.simpleSegment(t_for_tok);
        result.push(simpleTokens.map(token => ({
          surface: token.surface,
          lemma: token.lemma,
          reading: token.reading,
          pos: token.pos
        })));
      }
    }

    return { lines: result };
  }

  /**
   * Get Kana reading - using kuroshiro
   */
  async getReading(text) {
    if (!this.initialized) {
      await this.init();
    }

    try {
      return await this.kuroshiro.convert(text, { to: 'hiragana' });
    } catch (error) {
      console.error('Reading conversion error:', error);
      return text;
    }
  }
}

// Create global instance
window.JapaneseSegmenter = JapaneseSegmenter;
