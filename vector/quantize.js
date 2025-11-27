// Add this to your original SparseLexicalSearch.add():
const scale = 255;
const vecLength = vec.length;
const qbytes = new Uint8Array(vecLength);
for (let i = 0; i !== vecLength; ++i){
  qbytes[i] = ~~(vec[i] * scale);
}

// Store qbytes + scale instead of full vector
// In cosine: use qbytes[i] / 255 instead of vec[i]
