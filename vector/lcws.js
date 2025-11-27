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
