const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);
const decoder = new TextDecoder();
const decode = decoder.decode.bind(decoder);


async function hash(text) {
  const data = encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return decode(hashBuffer);
}
