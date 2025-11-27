// === SPARSE LEXICAL SEARCH — PURE JS OPTIMIZED ===
class SparseLexicalSearch {
  constructor(generator) {
    this.generator = generator;

    // Dimensions
    this.WORD_DIM = 300;
    this.PREFIX_DIM = 300;
    this.BIGRAM_START = 600;
    
    // Inverted indices: termIdx → Set of item IDs
    // We use an Array of Sets for slightly faster integer-indexed lookup than a Map
    this.index = {
      word: new Map(),
      prefix: new Map(),
      bigram: new Map(),
      char: new Map()
    };

    // Main storage
    this.items = new Map();
    this.bigramDim = null;
  }

  add(id, text, metadata = {}) {
    // 1. Generate Vector
    // We convert to Float32Array immediately for 4x memory savings vs standard Arrays
    const rawVector = this.generator.generateVector(text);
    const vector = new Float32Array(rawVector); 
    const vectorLength = vector.length;
    // Dynamic dimension sizing (run once)
    this.bigramDim ??= vectorLength - this.BIGRAM_START - 36;

    // 2. Pre-calculate Norm (Magnitude)
    // Optimization: Don't calculate this inside the search loop later
    let norm = 0;
    for (let i = 0; i !== vectorLength; ++i) {
      norm += vector[i] ** 2;
    }
    norm = norm ** 0.5;

    // 3. Sparsify
    const sparse = this._vectorToSparse(vector);

    // 4. Store
    // We store the pre-calculated norm here
    this.items.set(id, { text, metadata, vector, norm });

    // 5. Indexing
    sparse.word.forEach(idx => this._addToIndex(this.index.word, idx, id));
    sparse.prefix.forEach(idx => this._addToIndex(this.index.prefix, idx, id));
    sparse.bigram.forEach(idx => this._addToIndex(this.index.bigram, idx, id));
    sparse.char.forEach(idx => this._addToIndex(this.index.char, idx, id));
  }

  _addToIndex(map, idx, id) {
    let set = map.get(idx);
    if (!set) {
      set = new Set();
      map.set(idx, set);
    }
    set.add(id);
  }

  _vectorToSparse(vec) {
    const word = [], prefix = [], bigram = [], char = [];
    const vecLength = vec.length;

    // Single loop is faster than 4 separate loops
    for (let i = 0; i !== vecLength; ++i) {
      if (vec[i] === 0) continue; // Skip zeros immediately

      if (i < this.WORD_DIM) {
        word.push(i);
      } else if (i < 600) { // WORD + PREFIX
        prefix.push(i - this.WORD_DIM);
      } else if (i < vecLength - 36) { // BIGRAM REGION
        bigram.push(i - this.BIGRAM_START);
      } else { // LAST 36 (CHAR)
        char.push(i - (vecLength - 36));
      }
    }
    return { word, prefix, bigram, char };
  }

  search(queryText, k = 10) {
    const rawVec = this.generator.generateVector(queryText);
    const queryVec = new Float32Array(rawVec);
    const qSparse = this._vectorToSparse(queryVec);

    // 1. Calculate Query Norm once
    let queryNorm = 0;
    const queryVecLength = queryVec.length;
    for (let i = 0; i !== queryVecLength; ++i) {
      queryNorm += queryVec[i] * queryVec[i];
    }
    queryNorm = queryNorm ** 0.5;

    // 2. Candidate Generation (Rough Scoring)
    const candidates = new Map(); // id → rough score

    const boost = (map, indices, weight) => {
      const indicesLength = indices.length;
      for (let i = 0; i !== indicesLength; ++i) {
        const idx = indices[i];
        const matchSet = map.get(idx);
        if (matchSet) {
          for (const id of matchSet) {
            // Hot path: minimize object lookups
            const current = candidates.get(id);
            candidates.set(id, (current === undefined ? 0 : current) + weight);
          }
        }
      }
    };

    // Apply Boosts
    boost(this.index.word, qSparse.word, 15);
    boost(this.index.prefix, qSparse.prefix, 8);
    boost(this.index.bigram, qSparse.bigram, 4);
    boost(this.index.char, qSparse.char, 1);

    if (candidates.size === 0) return [];

    // 3. Pruning
    const topCandidates = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 150);
    const topCandidatesLength = topCandidates.length;
    for(let i = 0; i !== topCandidatesLength; ++i){
    // 4. Exact Re-ranking
    // We pass the pre-calculated queryNorm to avoid recalculating it
      const id = topCandidates[i][0];
      const item = this.items.get(id);
      const sim = this._cosine(queryVec, queryNorm, item.vector, item.norm);
      topCandidstes[i] = { id, similarity: sim, text: item.text, metadata: item.metadata };
    }
      

     return topCandidate.sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  // Optimized Cosine: Uses pre-calculated norms
  // Complexity: O(N) rather than O(N + NormCalc)
  _cosine(a, normA, b, normB) {
    if (normA === 0 || normB === 0) return 0;
    
    let dot = 0;
    // Loop unrolling or simple iteration over the raw arrays
    // Since vectors are typically sparse, we could optimize this further,
    // but Float32Array iteration is extremely fast in V8 engine.
    const aLength = a.length;
    for (let i = 0; i !== aLength; ++i) {
       // Only multiply if a[i] is significant (optional optimization)
       if (a[i] !== 0) dot += a[i] * b[i];
    }
    
    return dot / (normA * normB);
  }
}
