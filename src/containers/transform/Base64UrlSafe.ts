export function encodeBase64UrlSafe(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeBase64UrlSafe(base64) {
  base64 += Array(5 - base64.length % 4).join('=');
  base64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return new Buffer(base64, 'base64');
}

export const Base64UrlSafe = {
  decode: decodeBase64UrlSafe,
  encode: encodeBase64UrlSafe
};

export default Base64UrlSafe;
