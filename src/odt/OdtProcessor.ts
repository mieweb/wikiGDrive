import {FileContentService} from '../utils/FileContentService';
import * as JSZip from 'jszip';

export class OdtProcessor {
  private fileName: string;
  private contentXml: string;
  private files: { [p: string]: JSZip.JSZipObject };

  constructor(private fileSystem: FileContentService, private fileId: string) {
    this.fileName = fileId + '.odt';
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
  }

  async unzipAssets(destinationDirectory: FileContentService, destinationName: string) {
    const assetsDirectory = await destinationDirectory.getSubFileService(destinationName.replace('.md', '.assets'));
    await assetsDirectory.mkdir('');
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
      await assetsDirectory.writeBuffer(fileName, buffer);
    }
  }

  getContentXml() {
    return this.contentXml;
  }

}