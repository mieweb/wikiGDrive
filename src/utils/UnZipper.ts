'use strict';

import * as JSZip from 'jszip';
import {ImageMeta} from '../storage/DownloadFilesStorage';
import {getImageMeta} from './getImageMeta';

export class UnZipper {
  private html: string;
  private readonly images: ImageMeta[];

  constructor() {
    this.html = '<html></html>';
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
      if (relativePath.endsWith('.html')) {
        this.html = await (zip.file(relativePath).async('string'));
      }
      if (relativePath.endsWith('.png')) {
        const buffer = await files[relativePath].async('nodebuffer');
        this.images.push(Object.assign({ zipPath: relativePath.replace(/^images\//, '') }, await getImageMeta(buffer)));
      }
      if (relativePath.endsWith('.jpg')) {
        const buffer = await files[relativePath].async('nodebuffer');
        this.images.push(Object.assign({ zipPath: relativePath.replace(/^images\//, '') }, await getImageMeta(buffer)));
      }
    }
  }

  getHtml() {
    return this.html;
  }

  getImages(): ImageMeta[] {
    return this.images;
  }
}
