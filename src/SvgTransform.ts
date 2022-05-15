'use strict';

import { XmlDocument } from 'xmldoc';
import { Transform } from 'stream';
import {urlToFolderId} from './utils/idParsers';

export class SvgTransform extends Transform {
  private readonly localPath: string;
  private content: string;
  public readonly links: Set<string> = new Set<string>();

  constructor(localPath) {
    super();

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

  addLink(href: string) {
    if (href && !href.startsWith('#') && href.indexOf(':') > -1) {
      this.links.add(href);
    }
  }

  async _flush(callback) {
    const document = new XmlDocument(this.content);

    const urlToRelativePath = {};

    const findLinkInChild = (child) => {
      if (child.attr['xlink:href']) {
        const fileId = urlToFolderId(child.attr['xlink:href']);

        if (fileId) {
          this.addLink('gdoc:' + fileId);
          child.attr['xlink:href'] = 'gdoc:' + fileId;
        }
        urlToRelativePath[child.attr['xlink:href']] = null;
      }

      child.eachChild((child) => {
        findLinkInChild(child);
      });
    };

    document.eachChild((child) => {
      findLinkInChild(child);
    });

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
