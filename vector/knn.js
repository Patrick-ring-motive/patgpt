// ----- LCS & weighted LCS (unchanged logic, but tidy) -----
const lcs = function lcs(seq1, seq2) {
    "use strict";
    const arr1 = [...(seq1 ?? [])];
    const arr2 = [...(seq2 ?? [])];
    // ensure arr1 is the longer one (optional for memory)
    if (arr2.length > arr1.length) {
        [arr1, arr2] = [arr2, arr1];
    }
    const dp = Array(arr1.length + 1)
        .fill(0)
        .map(() => Array(arr2.length + 1).fill(0));
    const dp_length = dp.length;
    for (let i = 1; i !== dp_length; i++) {
        const dpi_length = dp[i].length;
        for (let x = 1; x !== dpi_length; x++) {
            if (arr1[i - 1] === arr2[x - 1]) {
                dp[i][x] = dp[i - 1][x - 1] + 1;
            } else {
                dp[i][x] = Math.max(dp[i][x - 1], dp[i - 1][x]);
            }
        }
    }
    return dp[arr1.length][arr2.length];
};

const weightedLCS = (seq1, seq2) => {
    // Accept strings or arrays
    const len1 = (seq1 && seq1.length) || 0;
    const len2 = (seq2 && seq2.length) || 0;
    if (len1 === 0 || len2 === 0) return 0;
    return (lcs(seq1, seq2) * Math.min(len1, len2)) / Math.max(len1, len2);
};

// ----- Trie (same) -----
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
            if (!node.children[char]) node.children[char] = new TrieNode();
            node = node.children[char];
        }
        node.isEnd = true;
    }
    // returns the longest prefix that is a complete word (returns '' if none)
    findLongestPrefix(word) {
        let node = this.root;
        let prefix = '';
        let lastEnd = '';
        for (const char of word) {
            if (!node.children[char]) break;
            node = node.children[char];
            prefix += char;
            if (node.isEnd) lastEnd = prefix;
        }
        return lastEnd;
    }
}

// ----- HybridVectorGenerator (now exposes dynamic dims) -----
class HybridVectorGenerator {
    constructor(wordVocab) {
        this.wordVocab = wordVocab.split('|');
        this.trie = new Trie();
        this.wordVocab.forEach(w => this.trie.insert(w));
        this.characters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
        const bigramCounts = {};
        this.wordVocab.forEach(word => {
            if (word.length > 1)
                for (let i = 0; i < word.length - 1; i++) {
                    const bigram = word.slice(i, i + 2);
                    if (/^[a-z0-9]{2}$/.test(bigram)) bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
                }
        });
        const allBigrams = Object.keys(bigramCounts).sort((a, b) => bigramCounts[b] - bigramCounts[a]);
        // keep top 20% most common bigrams
        this.bigrams = allBigrams.slice(0, Math.ceil(allBigrams.length * 0.2));

        // Dynamic dimension properties (exposed)
        this.wordDim = this.wordVocab.length;
        this.prefixDim = this.wordVocab.length;
        this.bigramDim = this.bigrams.length;
        this.charDim = this.characters.length;

        // layout: [words (wordDim) , prefixes (prefixDim) , bigrams (bigramDim) , chars (charDim)]
        this.bigramStart = this.wordDim + this.prefixDim;
        this.charStart = this.bigramStart + this.bigramDim;
        this.vectorDim = this.charStart + this.charDim;
    }

    generateVector(text) {
        // produce normalized histogram-like features, then quantize to 0..255
        text = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
        let words = text.split(/\s+/).filter(Boolean);
        const totalWords = words.length;
        const denomWords = totalWords || 1;

        // word frequency vector (exact matches)
        const wordVector = this.wordVocab.map(word => words.filter(w => w === word).length / denomWords);

        // remove exact matches, then find longest-prefix matches
        words = words.filter(w => !this.wordVocab.includes(w));
        const prefixCounts = new Array(this.wordVocab.length).fill(0);
        words = words.filter(word => {
            const prefix = this.trie.findLongestPrefix(word);
            if (prefix) {
                const idx = this.wordVocab.indexOf(prefix);
                if (idx !== -1) {
                    prefixCounts[idx]++;
                    return false; // remove word if prefix matched
                }
            }
            return true;
        });
        const prefixVector = prefixCounts.map(c => c / denomWords);

        // remaining words concatenated for bigram/char analysis
        let remainingText = words.join(''); // note: join removes spaces; this design is intentional
        const bigrams = remainingText.length > 1 ? Array.from({ length: remainingText.length - 1 }, (_, i) => remainingText.slice(i, i + 2)) : [];
        const totalBigrams = bigrams.length;
        const denomBigrams = totalBigrams || 1;
        const bigramVector = this.bigrams.map(bg => bigrams.filter(b => b === bg).length / denomBigrams);

        const chars = remainingText.split('');
        const totalChars = chars.length;
        const denomChars = totalChars || 1;
        const charVector = this.characters.map(ch => chars.filter(c => c === ch).length / denomChars);

        // final combined vector (float 0..1)
        const vec = [...wordVector, ...prefixVector, ...bigramVector, ...charVector];

        // quantize to bytes 0..255 to reduce storage (optional)
        const scale = 255;
        const vecLength = vec.length;
        const qbytes = new Uint8Array(vecLength);
        for (let i = 0; i !== vecLength; ++i) {
            // clamp to [0,1] defensively
            let v = vec[i];
            if (!Number.isFinite(v) || v < 0) v = 0;
            else if (v > 1) v = 1;
            qbytes[i] = Math.floor(v * scale);
        }
        // return typed array (Array-like) — caller converts to Float32Array if desired
        return qbytes;
    }
}

// ----- Example vocab and generator init -----
const vocab = "years|ways|worlds|live|lives|hands|parts|children|eyes|places|weeks|cases|points|numbers|groups|problems|facts|times|days|men|women|one|two|three|four|five|six|seven|eight|nine|ten|zero|none|size|sized|sizes|sizing|calls|called|calling|leaves|lefts|leaving|try|tries|trying|feels|felt|feeling|seems|seemed|seeming|asks|asked|asking|tells|told|telling|finds|found|finding|looks|looked|looking|see|sees|seeing|saw|knows|knowing|knew|get|gets|got|getting|works|worked|working|I|a|able|about|after|all|also|am|an|and|any|are|as|ask|at|back|bad|be|because|been|being|bes|big|but|by|call|came|can|case|child|come|comes|coming|company|could|day|different|do|does|doing|done|early|even|eye|fact|feel|few|find|first|for|from|gave|get|give|gives|giving|go|goes|going|good|government|great|group|had|hand|has|have|he|her|high|him|his|how|if|important|in|into|is|it|its|just|know|large|last|leave|life|like|little|long|look|make|makes|making|man|me|most|my|new|next|no|not|now|number|of|old|on|one|only|or|other|our|out|over|own|part|people|person|place|point|problem|public|right|said|same|saw|say|says|see|seeing|seem|sees|shall|she|should|small|so|some|take|takes|taking|tell|than|that|the|their|them|then|there|these|they|thing|think|thinking|thinks|this|thought|time|to|took|try|two|up|us|use|used|uses|using|want|wanted|wanting|wants|was|way|we|week|well|went|were|what|when|which|who|will|with|woman|work|world|would|year|yes|yet|you|young|your";
const generator = new HybridVectorGenerator(vocab);

// ----- SparseLexicalSearch (clean & dynamic) -----
class SparseLexicalSearch {
    constructor(generator) {
        this.generator = generator;

        // Dimensions read from generator (no magic numbers)
        this.wordDim = generator.wordDim;
        this.prefixDim = generator.prefixDim;
        this.bigramDim = generator.bigramDim;
        this.charDim = generator.charDim;
        this.bigramStart = generator.bigramStart;
        this.charStart = generator.charStart;
        this.vectorDim = generator.vectorDim;

        // Inverted indices (maps index -> Set of ids)
        this.index = {
            word: new Map(),
            prefix: new Map(),
            bigram: new Map(),
            char: new Map()
        };

        // storage: id -> { text, metadata, vector (Float32Array), norm }
        this.items = new Map();
    }

    add(id, text, metadata = {}) {
        // 1. Generate vector (Uint8Array)
        const rawVector = this.generator.generateVector(text);
        // convert to Float32Array for arithmetic (we keep quantized values)
        const vector = new Float32Array(rawVector);
        const vectorLength = vector.length;
        if (vectorLength !== this.vectorDim) {
            // defensive: if generator changed, recompute dims or throw
            throw new Error(`Vector length mismatch: expected ${this.vectorDim}, got ${vectorLength}`);
        }

        // 2. Pre-calc norm
        let norm = 0;
        for (let i = 0; i !== vectorLength; ++i) {
            const v = vector[i];
            norm += v * v;
        }
        norm = Math.sqrt(norm);

        // 3. Sparsify (get indices per region)
        const sparse = this._vectorToSparse(vector);

        // 4. Store item
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
        // Return local indices for each region:
        // word: [0..wordDim-1]
        // prefix: [0..prefixDim-1]
        // bigram: [0..bigramDim-1]
        // char: [0..charDim-1]
        const word = [], prefix = [], bigram = [], char = [];
        const vecLength = vec.length;

        for (let i = 0; i !== vecLength; ++i) {
            if (vec[i] === 0) continue;
            if (i < this.wordDim) {
                word.push(i);
            } else if (i < this.bigramStart) { // prefix region
                prefix.push(i - this.wordDim);
            } else if (i < this.charStart) { // bigram region
                bigram.push(i - this.bigramStart);
            } else { // char region
                char.push(i - this.charStart);
            }
        }
        return { word, prefix, bigram, char };
    }

    search(queryText, k = 10) {
        // Generate query vector and sparse indices
        const rawVec = this.generator.generateVector(queryText);
        const queryVec = new Float32Array(rawVec);
        if (queryVec.length !== this.vectorDim) {
            throw new Error(`Query vector length ${queryVec.length} != expected ${this.vectorDim}`);
        }
        const qSparse = this._vectorToSparse(queryVec);

        // 1. Query norm once
        let queryNorm = 0;
        for (let i = 0; i !== queryVec.length; ++i) queryNorm += queryVec[i] * queryVec[i];
        queryNorm = Math.sqrt(queryNorm);
        if (queryNorm === 0) return []; // nothing to match

        // 2. Candidate generation: boost counts using indices
        const candidates = new Map(); // id -> score (rough)
        const boost = (map, indices, weight, offset = 0) => {
            const L = indices.length;
            for (let i = 0; i < L; ++i) {
                const idx = indices[i];
                const matchSet = map.get(idx);
                if (!matchSet) continue;
                for (const id of matchSet) {
                    const cur = candidates.get(id);
                    candidates.set(id, (cur === undefined ? 0 : cur) + weight);
                }
            }
        };

        // apply weights (tunable)
        boost(this.index.word, qSparse.word, 15);
        boost(this.index.prefix, qSparse.prefix, 8);
        boost(this.index.bigram, qSparse.bigram, 4);
        boost(this.index.char, qSparse.char, 1);

        if (candidates.size === 0) return [];

        // 3. Prune to top-N rough candidates
        const topCandidates = Array.from(candidates.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 150)
            .map(e => e[0]); // extract ids

        // 4. Exact re-ranking using a sparse cosine: only iterate non-zero query indices (O(nnz))
        const reRanked = [];
        // helper to compute dot product by iterating over query's sparse indices
        const computeDot = (qvec, itemVec, qSparse) => {
            let dot = 0;
            // word region
            for (let i = 0; i < qSparse.word.length; ++i) {
                const idx = qSparse.word[i];
                dot += qvec[idx] * itemVec[idx];
            }
            // prefix region (local -> global)
            const prefBase = this.wordDim;
            for (let i = 0; i < qSparse.prefix.length; ++i) {
                const local = qSparse.prefix[i];
                const global = prefBase + local;
                dot += qvec[global] * itemVec[global];
            }
            // bigram region
            const bigBase = this.bigramStart;
            for (let i = 0; i < qSparse.bigram.length; ++i) {
                const local = qSparse.bigram[i];
                const global = bigBase + local;
                dot += qvec[global] * itemVec[global];
            }
            // char region
            const cBase = this.charStart;
            for (let i = 0; i < qSparse.char.length; ++i) {
                const local = qSparse.char[i];
                const global = cBase + local;
                dot += qvec[global] * itemVec[global];
            }
            return dot;
        };

        for (let i = 0; i < topCandidates.length; ++i) {
            const id = topCandidates[i];
            const item = this.items.get(id);
            if (!item) continue; // defensive
            // compute dot only across query nonzeros
            const dot = computeDot(queryVec, item.vector, qSparse);
            const sim = (item.norm === 0 || queryNorm === 0) ? 0 : dot / (queryNorm * item.norm);
            reRanked.push({
                id,
                similarity: sim,
                text: item.text,
                metadata: item.metadata
            });
        }

        // sort by exact similarity and return top-k
        reRanked.sort((a, b) => b.similarity - a.similarity);
        return reRanked.slice(0, k);
    }

    bestMatch(queryText, k = 10) {
        const matches = this.search(queryText, k);
        if (!matches || matches.length === 0) return null;
        let match = matches[0];
        let score = -Infinity;
        for (const m of matches) {
            // m.text is the stored text
            const s = weightedLCS(queryText, m.text);
            if (s > score) {
                score = s;
                match = m;
            }
        }
        return match;
    }
}

// ----- instantiate vector store -----
const vectorStore = new SparseLexicalSearch(generator);

// ----- usage example -----
// vectorStore.add('id1', 'the quick brown fox');
// vectorStore.add('id2', 'quick fox jumped');
// const res = vectorStore.search('quick fox', 5);
// const best = vectorStore.bestMatch('quick fox', 5);
// console.log(res, best);
