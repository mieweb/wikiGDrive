'use strict';

import * as JSZip from 'jszip';
import {ImageMeta} from '../storage/DownloadFilesStorage';
import {getImageMeta} from './getImageMeta';

export class UnZipper {
  private xml: string;
  private readonly images: ImageMeta[];

  constructor() {
    this.xml = '<?xml version="1.0" encoding="UTF-8">\n<office:document-content></office:document-content>\n';
    this.images = [];
  }

  async load(input) {
    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(input);

    const files = {};
    zip.folder('').forEach((relativePath, entry) => {
      files[relativePath] = entry;
    });

    for (const relativePath in files) {
      if (relativePath.endsWith('content.xml')) {
        this.xml = await (zip.file(relativePath).async('string'));
      }
      if (relativePath.endsWith('.png')) {
        const buffer = await files[relativePath].async('nodebuffer');
        this.images.push(Object.assign({ zipPath: relativePath.replace(/^Pictures\//, '') }, await getImageMeta(buffer)));
      }
      if (relativePath.endsWith('.jpg')) {
        const buffer = await files[relativePath].async('nodebuffer');
        this.images.push(Object.assign({ zipPath: relativePath.replace(/^Pictures\//, '') }, await getImageMeta(buffer)));
      }
    }
  }

  getXml() {
    return this.xml;
  }

  getImages(): ImageMeta[] {
    return this.images;
  }
}
