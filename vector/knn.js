/**
 * - Banded LCS for token arrays
 * - Complexity: O(n · band)
 * - FIXED: Proper bounds checking for band indices
 */
function bandedLCS(tokensA, tokensB, similarityThreshold = 0.8) {
    const n = tokensA.length;
    const m = tokensB.length;

    if (n === 0 || m === 0) return 0;

    const maxLen = Math.max(n, m);

    // Required overlap
    const required = Math.ceil(similarityThreshold * maxLen);

    // Band size: how far from main diagonal we allow
    const band = Math.ceil((1 - similarityThreshold) * maxLen);

    // dp_prev and dp_curr represent only the band
    const width = 2 * band + 1;
    let dp_prev = new Int16Array(width);
    let dp_curr = new Int16Array(width);

    // Translate DP index j to band index
    // Returns -1 if out of band bounds
    const indexInBand = (i, j) => {
        const idx = j - (i - band);
        if (idx < 0 || idx >= width) return -1;
        return idx;
    };

    for (let i = 1; i <= n; i++) {
        dp_curr.fill(0);

        // Allowed j range
        const jStart = Math.max(1, i - band);
        const jEnd = Math.min(m, i + band);

        for (let j = jStart; j <= jEnd; j++) {
            const bi = indexInBand(i, j);
            if (bi < 0) continue; // defensive

            if (tokensA[i - 1] === tokensB[j - 1]) {
                const biD = indexInBand(i - 1, j - 1);
                dp_curr[bi] = (biD >= 0 ? dp_prev[biD] : 0) + 1;
            } else {
                const biL = indexInBand(i, j - 1);
                const biU = indexInBand(i - 1, j);
                const left = biL >= 0 ? dp_curr[biL] : 0;
                const up = biU >= 0 ? dp_prev[biU] : 0;
                dp_curr[bi] = Math.max(left, up);
            }
        }

        // Rotate buffers
        [dp_prev, dp_curr] = [dp_curr, dp_prev];
    }

    // LCS is at dp_prev index for j = m
    const finalIndex = indexInBand(n, m);
    return finalIndex >= 0 ? dp_prev[finalIndex] : 0;
}

const weightedLCS = (seq1, seq2) => {
    // Accept strings or arrays
    const len1 = (seq1 && seq1.length) || 0;
    const len2 = (seq2 && seq2.length) || 0;
    if (len1 === 0 || len2 === 0) return 0;
    return (bandedLCS(seq1, seq2) * Math.min(len1, len2)) / Math.max(len1, len2);
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

// ----- HybridVectorGenerator (now returns sparse format) -----
class HybridVectorGenerator {
    constructor(wordVocab) {
        // Fix: Use standard single quotes and ensure clean split
        this.wordVocab = wordVocab.replace(/\n/g, '').split(' | ').map(w => w.trim());
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
        this.bigrams = allBigrams.slice(0, Math.ceil(allBigrams.length * 0.2));


        // Dynamic dimension properties
        this.wordDim = this.wordVocab.length;
        this.prefixDim = this.wordVocab.length;
        this.bigramDim = this.bigrams.length;
        this.charDim = this.characters.length;

        this.bigramStart = this.wordDim + this.prefixDim;
        this.charStart = this.bigramStart + this.bigramDim;
        this.vectorDim = this.charStart + this.charDim;
    }

    /**
     * Generate vector as Uint8Array (quantized 0-255)
     * Returns: { vector: Uint8Array, sparse: {indices: Uint32Array, values: Uint8Array} }
     */
    generateVector(text) {
        text = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
        let words = text.split(/\s+/).filter(Boolean);
        const totalWords = words.length;
        const denomWords = totalWords || 1;

        // Word frequency vector
        const wordVector = this.wordVocab.map(word => words.filter(w => w === word).length / denomWords);

        // Prefix matching
        words = words.filter(w => !this.wordVocab.includes(w));
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
        const prefixVector = prefixCounts.map(c => c / denomWords);

        // Bigrams
        let remainingText = words.join('');
        const bigrams = remainingText.length > 1 ? Array.from({
            length: remainingText.length - 1
        }, (_, i) => remainingText.slice(i, i + 2)) : [];
        const totalBigrams = bigrams.length;
        const denomBigrams = totalBigrams || 1;
        const bigramVector = this.bigrams.map(bg => bigrams.filter(b => b === bg).length / denomBigrams);

        // Characters
        const chars = remainingText.split('');
        const totalChars = chars.length;
        const denomChars = totalChars || 1;
        const charVector = this.characters.map(ch => chars.filter(c => c === ch).length / denomChars);

        // Combined vector (float 0..1)
        const vec = [...wordVector, ...prefixVector, ...bigramVector, ...charVector];

        // Quantize to Uint8Array (0-255) AND extract sparse representation
        const scale = 255;
        const vecLength = vec.length;
        const denseVector = new Uint8Array(vecLength);
        const sparseIndices = [];
        const sparseValues = [];

        for (let i = 0; i < vecLength; ++i) {
            let v = vec[i];
            if (!Number.isFinite(v) || v < 0) v = 0;
            else if (v > 1) v = 1;
            const quantized = Math.floor(v * scale);
            denseVector[i] = quantized;

            // Build sparse representation (only non-zero)
            if (quantized > 0) {
                sparseIndices.push(i);
                sparseValues.push(quantized);
            }
        }

        return {
            vector: denseVector,
            sparse: {
                indices: new Uint32Array(sparseIndices),
                values: new Uint8Array(sparseValues)
            }
        };
    }


}

// ----- Example vocab and generator init -----
// Fixed: Use backticks for multiline string and cleaned up the copy-paste
const vocab = `years | ways | worlds | live | lives | hands | parts | children | eyes | places | weeks | cases | points | numbers | groups | problems | facts | times | days | men | women | one | two | three | four | five | six | seven | eight | nine | ten | zero | none | size | sized | sizes | sizing | calls | called | calling | leaves | lefts | leaving |
try | tries | trying | feels | felt | feeling | seems | seemed | seeming | asks | asked | asking | tells | told | telling | finds | found | finding | looks | looked | looking | see | sees | seeing | saw | knows | knowing | knew | get | gets | got | getting | works | worked | working | I | a | able | about | after | all | also | am | an | and | any | are | as | ask | at | back | bad | be | because | been | being | bes | big | but | by | call | came | can |
case | child | come | comes | coming | company | could | day | different | do | does | doing | done | early | even | eye | fact | feel | few | find | first |
for | from | gave | get | give | gives | giving | go | goes | going | good | government | great | group | had | hand | has | have | he | her | high | him | his | how |
if | important | in | into | is | it | its | just | know | large | last | leave | life | like | little | long | look | make | makes | making | man | me | most | my | new | next | no | not | now | number | of | old | on | one | only | or | other | our | out | over | own | part | people | person | place | point | problem | public | right | said | same | saw | say | says | see | seeing | seem | sees | shall | she | should | small | so | some | take | takes | taking | tell | than | that | the | their | them | then | there | these | they | thing | think | thinking | thinks | this | thought | time | to | took |
try | two | up | us | use | used | uses | using | want | wanted | wanting | wants | was | way | we | week | well | went | were | what | when | which | who | will | with | woman | work | world | would | year | yes | yet | you | young | your`;

const generator = new HybridVectorGenerator(vocab);

// ----- SparseLexicalSearch (FIXED: Uint8 arithmetic + optimized dot product) -----
class SparseLexicalSearch {
    constructor(generator) {
        this.generator = generator;


        this.wordDim = generator.wordDim;
        this.prefixDim = generator.prefixDim;
        this.bigramDim = generator.bigramDim;
        this.charDim = generator.charDim;
        this.bigramStart = generator.bigramStart;
        this.charStart = generator.charStart;
        this.vectorDim = generator.vectorDim;

        // Inverted indices (local indices -> Set of ids)
        this.index = {
            word: new Map(),
            prefix: new Map(),
            bigram: new Map(),
            char: new Map()
        };

        // Storage: id -> { text, metadata, vector (Uint8Array), sparse, norm (int) }
        this.items = new Map();
    }

    add(id, text, metadata = {}) {
        const {
            vector,
            sparse
        } = this.generator.generateVector(text);

        if (vector.length !== this.vectorDim) {
            throw new Error(`Vector length mismatch: expected ${this.vectorDim}, got ${vector.length}`);
        }

        // Pre-compute squared norm in integer space (for uint8, max ~= 255^2 * dim)
        let normSq = 0;
        for (let i = 0; i < sparse.values.length; ++i) {
            const v = sparse.values[i];
            normSq += v * v;
        }

        // Store item with sparse representation
        this.items.set(id, {
            text,
            metadata,
            vector,
            sparse,
            normSq
        });

        // Index using sparse representation (efficient)
        this._indexSparseVector(sparse, id);
    }

    _indexSparseVector(sparse, id) {
        const indices = sparse.indices;

        for (let i = 0; i < indices.length; ++i) {
            const globalIdx = indices[i];
            let map, localIdx;

            if (globalIdx < this.wordDim) {
                map = this.index.word;
                localIdx = globalIdx;
            } else if (globalIdx < this.bigramStart) {
                map = this.index.prefix;
                localIdx = globalIdx - this.wordDim;
            } else if (globalIdx < this.charStart) {
                map = this.index.bigram;
                localIdx = globalIdx - this.bigramStart;
            } else {
                map = this.index.char;
                localIdx = globalIdx - this.charStart;
            }

            let set = map.get(localIdx);
            if (!set) {
                set = new Set();
                map.set(localIdx, set);
            }
            set.add(id);
        }
    }

    search(queryText, k = 10) {
        const {
            vector: queryVec,
            sparse: qSparse
        } = this.generator.generateVector(queryText);

        if (queryVec.length !== this.vectorDim) {
            throw new Error(`Query vector length ${queryVec.length} != expected ${this.vectorDim}`);
        }

        // Compute query norm squared (integer space)
        let queryNormSq = 0;
        for (let i = 0; i < qSparse.values.length; ++i) {
            const v = qSparse.values[i];
            queryNormSq += v * v;
        }
        if (queryNormSq === 0) return [];

        // Candidate generation with weighted boosting
        const candidates = new Map();

        // Helper to boost candidates based on index matches
        const boost = (map, queryIndices, weight) => {
            for (let i = 0; i < queryIndices.length; ++i) {
                const idx = queryIndices[i];
                let localIdx;

                // Convert global to local index based on region
                if (idx < this.wordDim) {
                    localIdx = idx;
                } else if (idx < this.bigramStart) {
                    localIdx = idx - this.wordDim;
                } else if (idx < this.charStart) {
                    localIdx = idx - this.bigramStart;
                } else {
                    localIdx = idx - this.charStart;
                }

                const matchSet = map.get(localIdx);
                if (!matchSet) continue;

                for (const id of matchSet) {
                    const cur = candidates.get(id);
                    candidates.set(id, (cur === undefined ? 0 : cur) + weight);
                }
            }
        };

        // Extract indices per region from query sparse representation
        const qIndices = {
            word: [],
            prefix: [],
            bigram: [],
            char: []
        };
        for (let i = 0; i < qSparse.indices.length; ++i) {
            const idx = qSparse.indices[i];
            if (idx < this.wordDim) qIndices.word.push(idx);
            else if (idx < this.bigramStart) qIndices.prefix.push(idx);
            else if (idx < this.charStart) qIndices.bigram.push(idx);
            else qIndices.char.push(idx);
        }

        boost(this.index.word, qIndices.word, 15);
        boost(this.index.prefix, qIndices.prefix, 8);
        boost(this.index.bigram, qIndices.bigram, 4);
        boost(this.index.char, qIndices.char, 1);

        if (candidates.size === 0) return [];

        // Prune to top candidates
        const topCandidates = Array.from(candidates.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 150)
            .map(e => e[0]);

        // OPTIMIZED: Sparse dot product using pre-computed sparse representations
        // Build lookup for query values by index
        const queryLookup = new Map();
        for (let i = 0; i < qSparse.indices.length; ++i) {
            queryLookup.set(qSparse.indices[i], qSparse.values[i]);
        }

        const reRanked = [];
        for (let i = 0; i < topCandidates.length; ++i) {
            const id = topCandidates[i];
            const item = this.items.get(id);
            if (!item) continue;

            // Compute dot product: only iterate over item's sparse indices
            // (typically fewer non-zeros than query)
            let dotProduct = 0;
            const itemIndices = item.sparse.indices;
            const itemValues = item.sparse.values;

            for (let j = 0; j < itemIndices.length; ++j) {
                const idx = itemIndices[j];
                const qVal = queryLookup.get(idx);
                if (qVal !== undefined) {
                    dotProduct += itemValues[j] * qVal;
                }
            }

            // Cosine similarity in integer space: dot / sqrt(normSq1 * normSq2)
            // To avoid precision loss, compute in float at the end
            const denom = Math.sqrt(item.normSq * queryNormSq);
            const sim = denom === 0 ? 0 : dotProduct / denom;

            reRanked.push({
                id,
                similarity: sim,
                text: item.text,
                metadata: item.metadata
            });
        }

        reRanked.sort((a, b) => b.similarity - a.similarity);
        return reRanked.slice(0, k);
    }

    bestMatch(queryText, k = 10) {
        const matches = this.search(queryText, k);
        if (!matches || matches.length === 0) return null;

        let bestMatch = matches[0];
        let bestScore = -Infinity;

        for (const m of matches) {
            const score = weightedLCS(queryText, m.text);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = m;
            }
        }
        return bestMatch;
    }


}

// ----- instantiate vector store -----
const vectorStore = new SparseLexicalSearch(generator);
