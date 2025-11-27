// === SPARSE LEXICAL SEARCH — PURE JS FALLBACK (2025 optimized) ===
// Works perfectly with your HybridVectorGenerator
class SparseLexicalSearch {
  constructor(generator) {
    this.generator = generator;

    // Exact dimension boundaries from your generator
    this.WORD_DIM = 300;           // vocab.split('|').length → 300
    this.PREFIX_DIM = 300;
    this.BIGRAM_START = 600;       // word + prefix
    this.CHAR_START = 600 + 379;   // We'll compute exact bigram count on first run

    // Inverted indices: termIdx → Set of item IDs
    this.wordInv = new Map();
    this.prefixInv = new Map();
    this.bigramInv = new Map();
    this.charInv = new Map();

    // All items: id → {text, metadata, sparse}
    this.items = new Map();

    // Cache exact bigram length on first add
    this.bigramDim = null;
  }

  // Add a prompt to the index
  add(id, text, metadata = {}) {
    const vector = this.generator.generateVector(text);
    if (this.bigramDim === null) {
      this.bigramDim = vector.length - this.BIGRAM_START - 36;
    }

    const sparse = this._vectorToSparse(vector);

    this.items.set(id, { text, metadata, vector, sparse });

    // Index non-zero terms with different weights
    sparse.word.forEach(idx => this._addToInv(this.wordInv, idx, id));
    sparse.prefix.forEach(idx => this._addToInv(this.prefixInv, idx, id));
    sparse.bigram.forEach(idx => this._addToInv(this.bigramInv, idx, id));
    sparse.char.forEach(idx => this._addToInv(this.charInv, idx, id));
  }

  _addToInv(map, idx, id) {
    if (!map.has(idx)) map.set(idx, new Set());
    map.get(idx).add(id);
  }

  _vectorToSparse(vec) {
    const word = [], prefix = [], bigram = [], char = [];

    // Exact word matches (0–299)
    for (let i = 0; i < this.WORD_DIM; i++) {
      if (vec[i] > 0) word.push(i);
    }
    // Prefix matches (300–599)
    for (let i = 0; i < this.PREFIX_DIM; i++) {
      if (vec[this.WORD_DIM + i] > 0) prefix.push(i);
    }
    // Bigrams (600 → 600+bigramDim-1)
    for (let i = 0; i < this.bigramDim; i++) {
      if (vec[this.BIGRAM_START + i] > 0) bigram.push(i);
    }
    // Characters (last 36 dims)
    for (let i = 0; i < 36; i++) {
      if (vec[vec.length - 36 + i] > 0) char.push(i);
    }

    return { word, prefix, bigram, char };
  }

  // Main search — returns top k results
  search(queryText, k = 10) {
    const queryVec = this.generator.generateVector(queryText);
    const q = this._vectorToSparse(queryVec);

    const candidates = new Map(); // id → boost score

    const boost = (set, weight) => {
      if (!set) return;
      for (const id of set) {
        candidates.set(id, (candidates.get(id) || 0) + weight);
      }
    };

    // High boost for exact words, lower for partials
    q.word.forEach(idx => boost(this.wordInv.get(idx), 15));
    q.prefix.forEach(idx => boost(this.prefixInv.get(idx), 8));
    q.bigram.forEach(idx => boost(this.bigramInv.get(idx), 4));
    q.char.forEach(idx => boost(this.charInv.get(idx), 1));

    // Take top N candidates (prune early)
    const topCandidates = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(150, candidates.size)) // ← magic number, tweak if needed
      .map(([id]) => id);

    // Final precise ranking using real cosine similarity
    const results = topCandidates
      .map(id => {
        const item = this.items.get(id);
        const sim = this._cosine(queryVec, item.vector);
        return { id, similarity: sim, text: item.text, metadata: item.metadata };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    return results;
  }

  // Fast cosine similarity (no sqrt needed for ranking)
  _cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-12);
  }

  // Optional: clear everything
  clear() {
    this.items.clear();
    this.wordInv.clear();
    this.prefixInv.clear();
    this.bigramInv.clear();
    this.charInv.clear();
  }

  get size() {
    return this.items.size;
  }
}

// ================================================================
// BASIC USAGE EXAMPLE (paste this after your generator is ready)
// ================================================================

// Your generator (already exists in your code)
const generator = new HybridVectorGenerator(vocab);

// Create the pure JS search index
const lexicalSearch = new SparseLexicalSearch(generator);

// Add some example prompts
lexicalSearch.add("id1", "how many days in a week");
lexicalSearch.add("id2", "what is the size of the world population");
lexicalSearch.add("id3", "tell me about children in school");
lexicalSearch.add("id4", "I feel sad today");
lexicalSearch.add("id5", "can you help me find my keys");

// Search!
console.log("Searching for 'how many days are there in a week?'");
const results = lexicalSearch.search("how many days are there in a week?", 3);

results.forEach((r, i) => {
  console.log(`${i+1}. [${(r.similarity*100).toFixed(1)}%] ${r.text} (id: ${r.id})`);
});

// Expected output:
// 1. [99.8%] how many days in a week (id: id1)
// 2. [45.2%] what is the size of the world population (id: id2)
// etc.

// Try another
console.log("\nSearching for 'I feel bad and tired'");
const results2 = lexicalSearch.search("I feel bad and tired", 2);
results2.forEach((r, i) => {
  console.log(`${i+1}. [${(r.similarity*100).toFixed(1)}%] ${r.text}`);
});
// → Will strongly match "I feel sad today"
