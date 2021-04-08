import * as path from 'path';
import * as fs from 'fs';
import * as JSZip from 'jszip';

export class ImageUnZipper {

  async unpack(input, destPath: string) {
    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(input);

    const files = {};
    zip.folder('').forEach((relativePath, entry) => {
      files[relativePath] = entry;
    });

    for (const relativePath in files) {
      if (relativePath.endsWith('.png')) {
        const buffer = await files[relativePath].async('nodebuffer');
        const fileName = path.basename(relativePath);
        fs.writeFileSync(path.join(destPath, fileName), buffer);
      }
    }
  }
}
