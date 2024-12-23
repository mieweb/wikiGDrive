import sharp from 'sharp';
import phash from 'sharp-phash';
import dist from 'sharp-phash/distance.js';

export function getImageDistance(hash1, hash2) {
  return dist(hash1, hash2);
}

export async function getImageMeta(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    hash: await phash(buffer)
  };
}
