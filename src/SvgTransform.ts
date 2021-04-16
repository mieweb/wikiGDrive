'use strict';

import { XmlDocument } from 'xmldoc';
import { Transform } from 'stream';
import { LinkTranslator } from './LinkTranslator';
import {urlToFolderId} from './utils/idParsers';

export class SvgTransform extends Transform {
  private linkTranslator: LinkTranslator;
  private readonly localPath: string;
  private content: string;

  constructor(localPath, linkTranslator: LinkTranslator) {
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
    const document = new XmlDocument(this.content);

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

    for (let url in urlToRelativePath) {
      const id = urlToFolderId(url);

      if (id) {
        const localPath = await this.linkTranslator.urlToDestUrl(id);
        if (localPath !== id) {
          urlToRelativePath[url] = this.linkTranslator.convertToRelativeSvgPath(localPath, this.localPath);
        }
      } else {
        const localPath = await this.linkTranslator.urlToDestUrl(url);
        if (localPath !== url) {
          urlToRelativePath[url] = this.linkTranslator.convertToRelativeSvgPath(localPath, this.localPath);
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
