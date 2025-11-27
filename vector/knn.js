class TrieNode { constructor(){ this.children = {}; this.isEnd = false; } }
class Trie {
  constructor(){ this.root = new TrieNode(); }
  insert(word){ let node = this.root; for (const char of word){ if (!node.children[char]) node.children[char] = new TrieNode(); node = node.children[char]; } node.isEnd = true; }
  findLongestPrefix(word){ let node = this.root; let prefix=''; for (const char of word){ if (!node.children[char]) break; node = node.children[char]; prefix += char; if (node.isEnd) return prefix; } return ''; }
}
class HybridVectorGenerator {
  constructor(wordVocab) {
    this.wordVocab = wordVocab.split('|');
    this.trie = new Trie();
    this.wordVocab.forEach(w => this.trie.insert(w));
    this.characters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const bigramCounts = {};
    this.wordVocab.forEach(word=>{
      if (word.length>1) for (let i=0;i<word.length-1;i++){
        const bigram = word.slice(i,i+2);
        if (/^[a-z0-9]{2}$/.test(bigram)) bigramCounts[bigram]=(bigramCounts[bigram]||0)+1;
      }
    });
    const allBigrams = Object.keys(bigramCounts).sort((a,b)=>bigramCounts[b]-bigramCounts[a]);
    this.bigrams = allBigrams.slice(0, Math.ceil(allBigrams.length*0.2));
    this.vectorDim = this.wordVocab.length + this.wordVocab.length + this.bigrams.length + this.characters.length;
  }

  generateVector(text){
    text = text.toLowerCase().replace(/[^a-z0-9\s]/g,'');
    let words = text.split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    const wordVector = this.wordVocab.map(word => words.filter(w=>w===word).length / (totalWords||1));
    words = words.filter(w => !this.wordVocab.includes(w));
    const prefixCounts = new Array(this.wordVocab.length).fill(0);
    words = words.filter(word=>{
      const prefix = this.trie.findLongestPrefix(word);
      if (prefix){
        const idx = this.wordVocab.indexOf(prefix);
        if (idx !== -1){ prefixCounts[idx]++; return false; }
      }
      return true;
    });
    const prefixVector = prefixCounts.map(c => c / (totalWords || 1));
    let remainingText = words.join('');
    const bigrams = remainingText.length > 1 ? Array.from({length: remainingText.length-1}, (_,i)=>remainingText.slice(i,i+2)) : [];
    const totalBigrams = bigrams.length;
    const bigramVector = this.bigrams.map(bg => bigrams.filter(b=>b===bg).length / (totalBigrams||1));
    const chars = remainingText.split('');
    const totalChars = chars.length;
    const charVector = this.characters.map(ch => chars.filter(c=>c===ch).length / (totalChars||1));
    return [...wordVector, ...prefixVector, ...bigramVector, ...charVector];
  }
}

const vocab = "years|ways|worlds|live|lives|hands|parts|children|eyes|places|weeks|cases|points|numbers|groups|problems|facts|times|days|men|women|one|two|three|four|five|six|seven|eight|nine|ten|zero|none|size|sized|sizes|sizing|calls|called|calling|leaves|lefts|leaving|try|tries|trying|feels|felt|feeling|seems|seemed|seeming|asks|asked|asking|tells|told|telling|finds|found|finding|looks|looked|looking|see|sees|seeing|saw|knows|knowing|knew|get|gets|got|getting|works|worked|working|I|a|able|about|after|all|also|am|an|and|any|are|as|ask|at|back|bad|be|because|been|being|bes|big|but|by|call|came|can|case|child|come|comes|coming|company|could|day|different|do|does|doing|done|early|even|eye|fact|feel|few|find|first|for|from|gave|get|give|gives|giving|go|goes|going|good|government|great|group|had|hand|has|have|he|her|high|him|his|how|if|important|in|into|is|it|its|just|know|large|last|leave|life|like|little|long|look|make|makes|making|man|me|most|my|new|next|no|not|now|number|of|old|on|one|only|or|other|our|out|over|own|part|people|person|place|point|problem|public|right|said|same|saw|say|says|see|seeing|seem|sees|shall|she|should|small|so|some|take|takes|taking|tell|than|that|the|their|them|then|there|these|they|thing|think|thinking|thinks|this|thought|time|to|took|try|two|up|us|use|used|uses|using|want|wanted|wanting|wants|was|way|we|week|well|went|were|what|when|which|who|will|with|woman|work|world|would|year|yes|yet|you|young|your";

// Init generator
const generator = new HybridVectorGenerator(vocab);



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


const vectorStore = SparseLexicalSearch(generator);
