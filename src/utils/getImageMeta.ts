import * as sharp from 'sharp';
import * as phash from 'sharp-phash';
import * as dist from 'sharp-phash/distance';

export async function getImageMeta(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    hash: await phash(buffer)
  };
}
