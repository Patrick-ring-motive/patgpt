const setCacheHeaders = (headers=new Headers(), seconds = 31535000 ) => {
  for (const header of ["CDN-Cache-Control", "Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control", "Vercel-CDN-Cache-Control"]) {
      headers.set(header, `public, max-age=${seconds}, s-max-age=${seconds}, stale-if-error=31535000, stale-while-revalidate=31535000`);
  }
  for (const header of ['vary', 'etag', 'nel', 'pragma', 'cf-ray']) {
      headers.delete(header);
  }
  headers.set('nel', '{}');
  return headers;
};

const decodeComponent = x => {
  try{
    return decodeURIComponent(x);
  }catch{
    return x;
  }
};

const deparse = x =>{
  try{
    return JSON.parse(x);
  }catch{
    return JSON.parse(decodeComponent(x));
  }
};

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
  return vec;
 /* let sum=0; for (let v of vec) sum += v*v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map(v => v / norm);*/
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
      return await this.cache.put(Stash.urlKey(key),new Response(value,{headers:setCacheHeaders()}));
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


// Pure functions instead of prototype methods
const rm = (str, re) => String(str).replace(re, '');
const splitWords = (str) => String(str).split(/\s+/);

const lcs = function lcs(seq1, seq2) {
    "use strict";
    let arr1 = [...seq1 ?? []];
    let arr2 = [...seq2 ?? []];
    if (arr2.length > arr1.length) {
        [arr1, arr2] = [arr2, arr1];
    }
    const dp = Array(arr1.length + 1).fill(0).map(() => Array(arr2.length + 1).fill(0));
    const dp_length = dp.length;
    for (let i = 1; i !== dp_length; i++) {
        const dpi_length = dp[i].length;
        for (let x = 1; x !== dpi_length; x++) {
            if (arr1[i - 1] === arr2[x - 1]) {
                dp[i][x] = dp[i - 1][x - 1] + 1
            } else {
                dp[i][x] = Math.max(dp[i][x - 1], dp[i - 1][x])
            }
        }
    }
    return dp[arr1.length][arr2.length]
};

const wordMatch = function wordMatch(str1, str2) {
    return lcs(str1, str2) >= Math.floor(0.8 * Math.max(str1?.length ?? 0, str2?.length ?? 0));
}

const lcws = function lcws(seq1, seq2) {
    "use strict";
    let arr1 = splitWords(rm(seq1, /[^a-zA-Z ]/g).toLowerCase());
    let arr2 = splitWords(rm(seq2, /[^a-zA-Z ]/g).toLowerCase());
    if (arr2.length > arr1.length) {
        [arr1, arr2] = [arr2, arr1];
    }
    const dp = Array(arr1.length + 1).fill(0).map(() => Array(arr2.length + 1).fill(0));
    const dp_length = dp.length;
    for (let i = 1; i !== dp_length; i++) {
        const dpi_length = dp[i].length;
        for (let x = 1; x !== dpi_length; x++) {
            if (wordMatch(arr1[i - 1], arr2[x - 1])) {
                dp[i][x] = dp[i - 1][x - 1] + 1
            } else {
                dp[i][x] = Math.max(dp[i][x - 1], dp[i - 1][x])
            }
        }
    }
    return dp[arr1.length][arr2.length]
};

const weightedLCWS = (str1,str2)=>{
  str1 = String(str1);
  str2 = String(str2);
  return lcws(str1,str2) / Math.sqrt(Math.abs(str1.length - str2.length) + 1);
};

const phraseMatch = function phraseMatch(str1, str2) {
    str1=decodeComponent(decodeComponent(String(str1)));
    str2=decodeComponent(decodeComponent(String(str2)));
    const len = Math.floor(0.8 * Math.max(splitWords(str1).length, splitWords(str2).length));
    const lcwsLen = lcws(str1,str2);
    console.log({
        len,
        lcwsLen
    });
    return lcwsLen >= len;
};

const allowAll = (headers={})=>{
  for(const allow of ['Origin','Methods','Headers']){
    headers[`Access-Control-Allow-${allow}`] = '*';
  }
  return headers;
};

const getPrompt = (text)=>{
  try{
    const {prompt} = deparse(text);
    return prompt;
  }catch(e){
    console.warn(e);
    return '';
  }
};

let store;
async function onRequest(request, env) {
  if(request.headers.get('anti-bot')!=='yes'){
    return new Response("hello",{headers:allowAll()});
  }
  if(!store) store = new Stash();
  if(store instanceof Promise)store = await store;
  if(request.url.includes('upsert')){
    const text = await request.text();
    let {prompt} = deparse(text);
    prompt = decodeComponent(decodeComponent(prompt));
    if(!/[a-z]/i.test(prompt))return new Response(null,{status:400,headers:allowAll()});
    const key = await hash(prompt);
    const vec = generator.generateVector(prompt);
    const normalized = normalizeL2(vec);
    await env.PATGPT_VECTOR_CACHE.upsert([{ id:key, values: normalized}]);
    await store.set(key,text);
    return new Response(text,{
      status:200,
      headers:allowAll()
    });
  }
  if(/query|match/.test(request.url)){
    const reqText = await request.text();
    let {prompt} = deparse(reqText);
    prompt = decodeComponent(decodeComponent(prompt));
    if(!/[a-z]/i.test(prompt))return new Response(null,{status:400,headers:allowAll()});
    const vec = generator.generateVector(prompt);
    const normalized = normalizeL2(vec);
    const matches = await env.PATGPT_VECTOR_CACHE.query(normalized, { topK:1, returnValues:true,returnMetadata: 'all' });
    const id = matches?.matches?.[0]?.id;
    if(id){
      console.log(id);
      let text = decodeComponent(await store.get(id));
      console.log(text);
      const prompts = text.split('{"prompt":"');
      prompts.shift();
      const payload = prompts.join(' ').trim();
      const responses = payload.split(',"response":"');
      const textPrompt = responses[0] || '';
      const textResponse = (responses[1]||'').slice(0,-2);
      text = JSON.stringify({prompt:textPrompt,response:textResponse});
      const res = new Response(text, { 
        headers: allowAll({ 
          'Content-Type': 'application/json'
        })
      });
      if(!request.url.includes('match')){
        return res;
      }
      const cachePrompt = getPrompt(text);
      if(cachePrompt && phraseMatch(cachePrompt,prompt)){
        return res;
      }
    }
    return new Response(null,{status:404,headers:allowAll()});
  }

}
export default {
  async fetch(request, env) {
    try{
      return await onRequest(...arguments);
    }catch(e){
      return new Response(String(e?.message ??e),{headers:allowAll()});
    }
  }
};
