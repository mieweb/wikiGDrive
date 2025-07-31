import crypto from 'node:crypto';

export async function generateMD5Hash(data: BufferSource) {
  // TODO: migrate to sha256
  // const buffer = Buffer.from(data);

  const hash = crypto.createHash('md5')
                      .update(data)
                      .digest('hex');

  return hash;
}
