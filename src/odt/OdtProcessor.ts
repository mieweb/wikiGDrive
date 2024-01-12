import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import crypto from 'crypto';

function getExt(fileName) {
  const idx = fileName.lastIndexOf('.');
  if (idx > -1) {
    return fileName.substring(idx);
  }
  return '';
}

export class OdtProcessor {
  private contentXml: string;
  private stylesXml: string;
  private files: { [p: string]: JSZip.JSZipObject };
  private fileNameMap: { [name: string]: string };

  constructor(private odtPath: string, private contentAddressable = false) {
    this.fileNameMap = {};
  }

  async load() {
    if (!fs.existsSync(this.odtPath)) {
      return;
    }
    const jsZip = new JSZip();
    const input: Buffer = fs.readFileSync(this.odtPath);
    const zip = await jsZip.loadAsync(input);

    this.files = zip.folder('').files;

    if (this.files['content.xml']) {
      this.contentXml = await this.files['content.xml'].async('string');
    }
    if (this.files['styles.xml']) {
      this.stylesXml = await this.files['styles.xml'].async('string');
    }
  }

  async unzipAssets(destinationPath: string, destinationName: string) {
    const assetsDirectory = path.join(destinationPath, destinationName.replace(/.md$/, '.assets'));

    if (!fs.existsSync(assetsDirectory)) {
      fs.mkdirSync(assetsDirectory, { recursive: true });
    }

    const written = [];
    for (const relativePath in this.files) {
      if (!relativePath.endsWith('.png') && !relativePath.endsWith('.jpg')) {
        continue;
      }
      if (relativePath.endsWith('thumbnail.png')) {
        continue;
      }
      const entry = this.files[relativePath];
      const buffer = await entry.async('nodebuffer');
      const fileName = relativePath.split('/').pop();

      const ext = getExt(fileName);
      if (this.contentAddressable && ext) {
        const hash = crypto.createHash('md5');
        hash.setEncoding('hex');
        hash.write(buffer);
        hash.end();
        this.fileNameMap[fileName] = hash.read() + ext;
      } else {
        this.fileNameMap[fileName] = fileName;
      }
      written.push(this.fileNameMap[fileName]);
      fs.writeFileSync(path.join(assetsDirectory, this.fileNameMap[fileName]), buffer);
    }

    const files = fs.readdirSync(assetsDirectory);
    for (const file of files) {
      if (written.indexOf(file) === -1) {
        fs.unlinkSync(path.join(assetsDirectory, file));
      }
    }
  }

  getContentXml() {
    return this.contentXml;
  }

  getStylesXml() {
    return this.stylesXml;
  }

  getFileNameMap() {
    return this.fileNameMap;
  }

}
