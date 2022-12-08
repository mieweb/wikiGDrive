import {FileContentService} from '../utils/FileContentService';
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
  private readonly fileName: string;
  private contentXml: string;
  private stylesXml: string;
  private files: { [p: string]: JSZip.JSZipObject };
  private fileNameMap: { [name: string]: string };

  constructor(private fileSystem: FileContentService, private fileId: string, private contentAddressable = false) {
    this.fileName = fileId + '.odt';
    this.fileNameMap = {};
  }

  async load() {
    if (!await this.fileSystem.exists(this.fileName)) {
      return;
    }
    const jsZip = new JSZip();
    const input = await this.fileSystem.readBuffer(this.fileName);
    const zip = await jsZip.loadAsync(input);

    this.files = zip.folder('').files;

    if (this.files['content.xml']) {
      this.contentXml = await this.files['content.xml'].async('string');
    }
    if (this.files['styles.xml']) {
      this.stylesXml = await this.files['styles.xml'].async('string');
    }
  }

  async unzipAssets(destinationDirectory: FileContentService, destinationName: string) {
    const assetsDirectory = await destinationDirectory.getSubFileService(destinationName.replace('.md', '.assets'));
    await assetsDirectory.mkdir('');
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
      await assetsDirectory.writeBuffer(this.fileNameMap[fileName], buffer);
    }

    const files = await assetsDirectory.list('');
    for (const file of files) {
      if (written.indexOf(file) === -1) {
        await assetsDirectory.remove(file);
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
