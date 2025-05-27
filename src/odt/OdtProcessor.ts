import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import crypto from 'node:crypto';
import { Buffer } from "node:buffer";

function getExt(fileName: string) {
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
  private xmlMap: { [name: string]: string };

  constructor(private contentAddressable = false) {
    this.fileNameMap = {};
    this.xmlMap = {};
  }

  async load(odtPath: string) {
    if (!fs.existsSync(odtPath)) {
      return;
    }
    const jsZip = new JSZip();
    const input: Buffer = fs.readFileSync(odtPath);
    const zip = await jsZip.loadAsync(input);

    this.files = zip.folder('').files;

    if (this.files['content.xml']) {
      this.contentXml = await this.files['content.xml'].async('string');
    }
    if (this.files['styles.xml']) {
      this.stylesXml = await this.files['styles.xml'].async('string');
    }

    await this.processMathMl();
  }

  async loadFromBuffer(input: Buffer): Promise<void> {
    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(input);

    this.files = zip.folder('').files;

    if (this.files['content.xml']) {
      this.contentXml = await this.files['content.xml'].async('string');
    }
    if (this.files['styles.xml']) {
      this.stylesXml = await this.files['styles.xml'].async('string');
    }

    await this.processMathMl();
  }

  async processMathMl() {
    for (const relativePath in this.files) {
      if (!relativePath.endsWith('/content.xml')) {
        continue;
      }

      const fileName = relativePath.replace('/content.xml', '.xml').replace(/\s/g, '_');
      if (fileName.indexOf('/') === -1) {
        const entry = this.files[relativePath];
        const buffer = await entry.async('nodebuffer');

        const mathMl = new TextDecoder().decode(buffer);
        if (mathMl.indexOf('<math ') > -1) {
          this.xmlMap[fileName] = mathMl;
        }
      }
    }
  }

  async unzipAssets(destinationPath: string, destinationName: string) {
    const assetsDirectory = path.join(destinationPath, destinationName.replace(/.md$/, '.assets'));

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
      if (!fs.existsSync(assetsDirectory)) {
        fs.mkdirSync(assetsDirectory, { recursive: true });
      }
      fs.writeFileSync(path.join(assetsDirectory, this.fileNameMap[fileName]), buffer);
    }

    if (fs.existsSync(assetsDirectory)) {
      const files = fs.readdirSync(assetsDirectory);
      for (const file of files) {
        if (written.indexOf(file) === -1) {
          fs.unlinkSync(path.join(assetsDirectory, file));
        }
      }
    }

    if (written.length === 0) {
      if (fs.existsSync(assetsDirectory)) {
        fs.rmSync(assetsDirectory, { recursive: true, force: true });
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

  getXmlMap() {
    return this.xmlMap;
  }

}
