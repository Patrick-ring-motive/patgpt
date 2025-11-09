
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

// L2 normalize helper
function normalizeL2(vec){
  let sum=0; for (let v of vec) sum += v*v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map(v => v / norm);
}

const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);
const decoder = new TextDecoder();
const decode = decoder.decode.bind(decoder);


async function hash(text) {
  const data = encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const decoded = decode(hashBuffer);
  return decoded;
}

class Stash{
  constructor(name=''){
    try{
      this.cache = caches.open('stash'+String(name));
    }catch(e){
      console.warn(e);
    }
  }
  static urlKey(key){
    const url = new URL('https://stash.store/');
    url.searchParams.set('key',String(key));
    return String(url);
  }
  async get(key){
    try{
      if(this.cache instanceof Promise){
        this.cache = await this.cache;
      }
      const res = await this.cache.match(Stash.urlKey(key));
      return await res?.clone?.()?.text?.();
    }catch(e){
      console.warn(e,key);
    }
  }
  async set(key,value){
    try{
      if(this.cache instanceof Promise){
        this.cache = await this.cache;
      }
      console.log('Stash set',key,value);
      return await this.cache.put(Stash.urlKey(key),new Response(value));
    }catch(e){
      console.warn(e,key,value);
    }
  }
  async delete(key){
    try{
      if(this.cache instanceof Promise){
        this.cache = await this.cache;
      }
      return await this.cache.delete(Stash.urlKey(key));
    }catch(e){
      console.warn(e,key);
    }
  }
}

let store;

export default {
  async fetch(request, env) {
    if(request.headers.get('anti-bot')!=='yes'){
      return new Response("hello");
    }
    if(!store) store = new Stash();
    if(store instanceof Promise)store = await store;
    if(request.url.includes('upsert')){
      const text = await request.text();
      const {prompt} = JSON.parse(text);
      if(!/[a-z]/i.test(prompt))return new Response(null,{status:400});
      const key = await hash(prompt);
      const vec = generator.generateVector(prompt);
      const normalized = normalizeL2(vec);
      await env.PATGPT_VECTOR_CACHE.upsert([{ id:key, values: normalized}]);
      await store.set(key,text);
      return new Response(null,{
        status:204,
        headers:{
          'Access-Control-Allow-Origin':'*'
        }
      });
    }
    if(request.url.includes('query')){
      const {prompt} = await request.json();
      if(!/[a-z]/i.test(prompt))return new Response(null,{status:400});
      const vec = generator.generateVector(prompt);
      const normalized = normalizeL2(vec);
      const matches = await env.PATGPT_VECTOR_CACHE.query(normalized, { topK:1, returnValues:true,returnMetadata: 'all' });
      const id = matches?.matches?.[0]?.id;
      if(id){
        console.log(id);
        return new Response(await store.get(id), { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin':'*'
          }
        });
      }
      return new Response(null,{status:404});
    }

  }
};
