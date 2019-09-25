'use strict';

import { Transform } from 'stream';
import xmldoc from 'xmldoc';
import {GoogleDriveService} from './GoogleDriveService';

export class SvgTransform extends Transform {

  constructor(linkTranslator, localPath) {
    super();
    this.linkTranslator = linkTranslator;
    this.localPath = localPath;
    this.content = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.content += chunk;

    callback();
  }

  async _flush(callback) {
    const document = new xmldoc.XmlDocument(this.content);

    const urlToRelativePath = {};

    const findLinkInChild = (child) => {
      if (child.attr['xlink:href']) {
        urlToRelativePath[child.attr['xlink:href']] = null;
      }

      child.eachChild((child) => {
        findLinkInChild(child);
      });
    };

    document.eachChild((child) => {
      findLinkInChild(child);
    });

    const googleDriveService = new GoogleDriveService();

    for (let url in urlToRelativePath) {
      const id = googleDriveService.urlToFolderId(url);

      if (id) {
        const localPath = await this.linkTranslator.urlToDestUrl(id);
        urlToRelativePath[url] = this.linkTranslator.convertToRelativePath(localPath, this.localPath);
      } else {
        const localPath = await this.linkTranslator.urlToDestUrl(url);
        if (localPath !== url) {
          urlToRelativePath[url] = this.linkTranslator.convertToRelativePath(localPath, this.localPath);
        }
      }
    }

    const replaceLinkInChild = (child) => {
      if (child.attr['xlink:href']) {
        if (urlToRelativePath[child.attr['xlink:href']]) {
          child.attr['xlink:href'] = urlToRelativePath[child.attr['xlink:href']];
        }
      }

      child.eachChild((child) => {
        replaceLinkInChild(child);
      });
    };

    document.eachChild((child) => {
      replaceLinkInChild(child);
    });

    this.push(document.toString());

    callback();
  }

}
