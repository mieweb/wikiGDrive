export async function generateSha256Hash(data: Uint8Array) {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer,
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
