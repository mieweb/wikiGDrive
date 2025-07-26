export async function generateMD5Hash(data: BufferSource) {
  // Generate MD5 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('MD5', data);

  // Convert the hash to hexadecimal format
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}
