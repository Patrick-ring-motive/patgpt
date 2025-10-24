
// Trie Node for prefix matching
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEnd = true;
  }

  findLongestPrefix(word) {
    let node = this.root;
    let prefix = '';
    for (const char of word) {
      if (!node.children[char]) break;
      node = node.children[char];
      prefix += char;
      if (node.isEnd) return prefix;
    }
    return '';
  }
}

class HybridVectorGenerator {
  constructor(wordVocab) {
    this.wordVocab = wordVocab.split('|'); // 274 words
    this.trie = new Trie();
    this.wordVocab.forEach(word => this.trie.insert(word));
    this.characters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split(''); // 36 chars

    // Extract bigrams and compute frequencies
    const bigramCounts = {};
    this.wordVocab.forEach(word => {
      if (word.length > 1) {
        for (let i = 0; i < word.length - 1; i++) {
          const bigram = word.slice(i, i + 2);
          if (/^[a-z0-9]{2}$/.test(bigram)) {
            bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
          }
        }
      }
    });
    // Take top 20% by frequency
    const allBigrams = Object.keys(bigramCounts).sort((a, b) => bigramCounts[b] - bigramCounts[a]);
    this.bigrams = allBigrams.slice(0, Math.ceil(allBigrams.length * 0.2)); // ~100 bigrams
    this.vectorDim = this.wordVocab.length + this.wordVocab.length + 
                     this.bigrams.length + this.characters.length; // ~684
    console.log(`Vector dimensions: ${this.vectorDim} (Words: ${this.wordVocab.length}, Prefixes: ${this.wordVocab.length}, Bigrams: ${this.bigrams.length}, Chars: ${this.characters.length})`);
  }

  generateVector(text) {
    text = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    let words = text.split(/\s+/).filter(w => w);
    const totalWords = words.length;

    // Step 1: Vocabulary word counts
    const wordVector = this.wordVocab.map(word => 
      words.filter(w => w === word).length / (totalWords || 1)
    );
    words = words.filter(w => !this.wordVocab.includes(w));

    // Step 2: Prefix matches using trie
    const prefixCounts = new Array(this.wordVocab.length).fill(0);
    words = words.filter(word => {
      const prefix = this.trie.findLongestPrefix(word);
      if (prefix) {
        const idx = this.wordVocab.indexOf(prefix);
        if (idx !== -1) {
          prefixCounts[idx]++;
          return false;
        }
      }
      return true;
    });
    const prefixVector = prefixCounts.map(count => count / (totalWords || 1));

    // Step 3: Character bigrams
    let remainingText = words.join('');
    const bigrams = remainingText.length > 1 
      ? Array.from({ length: remainingText.length - 1 }, (_, i) => remainingText.slice(i, i + 2))
      : [];
    const totalBigrams = bigrams.length;
    const bigramVector = this.bigrams.map(bigram => 
      bigrams.filter(b => b === bigram).length / (totalBigrams || 1)
    );

    // Step 4: Single characters
    const chars = remainingText.split('');
    const totalChars = chars.length;
    const charVector = this.characters.map(char => 
      chars.filter(c => c === char).length / (totalChars || 1)
    );

    return [...wordVector, ...prefixVector, ...bigramVector, ...charVector];
  }
}

const stream = x => new Response(x,{duplex:"half"}).body;

class CachedVectorStore {
  constructor(vectorDim, cacheName = 'llm-cache') {
    this.vectorDim = vectorDim;
    this.vectors = []; // In-memory for similarity
    this.ids = [];     // Query texts as cache keys
    this.cacheName = cacheName;
    this.maxVectors = 1000; // Limit in-memory vectors
  }

  async insert(text, response, id = null) {
    const vector = generator.generateVector(text);
    if (!Array.isArray(vector) || vector.length !== this.vectorDim) {
      throw new Error(`Vector must be an array of length ${this.vectorDim}`);
    }
    if (this.vectors.length >= this.maxVectors) {
      this.vectors.shift();
      this.ids.shift();
    }
    this.vectors.push(vector.map(x => parseFloat(x)));
    const queryId = id !== null ? id : text;
    this.ids.push(queryId);

    // Compress and store in Cache API
    const cacheData = { query: text, response, vector, timestamp: Date.now() };
    const jsonData = JSON.stringify(cacheData);
    const compressed = stream(jsonData).pipeThrough(new CompressionStream('gzip'));
    try {
      const cache = await caches.open(this.cacheName);
      const cacheKey = new Request(queryId, { method: 'GET' });
      const cacheValue = new Response(compressed, {
        headers: { 'Content-Type': 'application/octet-stream' , 'Content-Encoding' : 'gzip' }
      });
      await cache.put(cacheKey, cacheValue);
    } catch (e) {
      console.error('Cache API error:', e);
      // Fallback: In-memory cache
      this._fallbackCache = this._fallbackCache || {};
      this._fallbackCache[queryId] = cacheData;
    }
  }

  async query(queryText, k = 5) {
    const queryVector = generator.generateVector(queryText);
    if (!Array.isArray(queryVector) || queryVector.length !== this.vectorDim) {
      throw new Error(`Query vector must be an array of length ${this.vectorDim}`);
    }
    if (this.vectors.length === 0) return [];

    // Find top-k similar vectors
    const similarities = this.vectors.map((vec, i) => ({
      id: this.ids[i],
      score: this._cosineSimilarity(queryVector, vec)
    }));
    similarities.sort((a, b) => b.score - a.score);
    const topK = similarities.slice(0, k);

    // Retrieve and decompress
    const results = [];
    const cache = await caches.open(this.cacheName).catch(() => null);
    for (const { id, score } of topK) {
      let cached;
      if (cache) {
        const cacheKey = new Request(id, { method: 'GET' });
        const response = await cache.match(cacheKey);
        if (response) {
          const decompressed = response.clone().body.pipeThrough(new DecompressionStream('gzip'));
          const text = await new Response(decompressed).text();
          cached = JSON.parse(text);
        }
      } else {
        cached = this._fallbackCache && this._fallbackCache[id];
      }
      // Filter old entries (1 day TTL)
      const maxAge = 24 * 60 * 60 * 1000;
      if (cached && cached.timestamp && Date.now() - cached.timestamp < maxAge) {
        results.push({ id, score, cached });
      } else {
        results.push({ id, score, cached: { query: id, response: null } });
      }
    }
    return results;
  }

  _dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  _norm(v) {
    return Math.sqrt(v.reduce((sum, val) => sum + val ** 2, 0));
  }

  _cosineSimilarity(a, b) {
    const dot = this._dotProduct(a, b);
    const normA = this._norm(a);
    const normB = this._norm(b);
    return normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
  }
}

// Your word list
const vocab = "years|ways|worlds|live|lives|hands|parts|children|eyes|places|weeks|cases|points|numbers|groups|problems|facts|times|days|men|women|one|two|three|four|five|six|seven|eight|nine|ten|zero|none|size|sized|sizes|sizing|calls|called|calling|leaves|lefts|leaving|try|tries|trying|feels|felt|feeling|seems|seemed|seeming|asks|asked|asking|tells|told|telling|finds|found|finding|looks|looked|looking|see|sees|seeing|saw|knows|knowing|knew|get|gets|got|getting|works|worked|working|I|a|able|about|after|all|also|am|an|and|any|are|as|ask|at|back|bad|be|because|been|being|bes|big|but|by|call|came|can|case|child|come|comes|coming|company|could|day|different|do|does|doing|done|early|even|eye|fact|feel|few|find|first|for|from|gave|get|give|gives|giving|go|goes|going|good|government|great|group|had|hand|has|have|he|her|high|him|his|how|if|important|in|into|is|it|its|just|know|large|last|leave|life|like|little|long|look|make|makes|making|man|me|most|my|new|next|no|not|now|number|of|old|on|one|only|or|other|our|out|over|own|part|people|person|place|point|problem|public|right|said|same|saw|say|says|see|seeing|seem|sees|shall|she|should|small|so|some|take|takes|taking|tell|than|that|the|their|them|then|there|these|they|thing|think|thinking|thinks|this|thought|time|to|took|try|two|up|us|use|used|uses|using|want|wanted|wanting|wants|was|way|we|week|well|went|were|what|when|which|who|will|with|woman|work|world|would|year|yes|yet|you|young|your";

// Initialize
const generator = new HybridVectorGenerator(vocab);
const store = new CachedVectorStore(generator.vectorDim, 'llm-cache');

// Cloudflare Worker event handler
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const queryText = url.searchParams.get('query') || 'The cat wants to run fast';
  const k = parseInt(url.searchParams.get('k') || '3');

  if (request.method === 'POST') {
    const { query, response } = await request.json();
    await store.insert(query, response, query);
    return new Response('Inserted', { status: 200 });
  }

  const results = await store.query(queryText, k);
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}
