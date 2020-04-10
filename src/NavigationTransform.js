'use strict';

import { Transform } from 'stream';
import { PREFIX_LEVEL } from './markdown/MarkDownTransform';

export class NavigationTransform extends Transform {

  constructor(files, link_mode) {
    super();

    this.link_mode = link_mode;
    this.files = files;
    this.hierarchy = {};
    this.markdown = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.markdown += chunk;

    callback();
  }

  async _flush(callback) {
    const lines = this.markdown.split('\n')
      .filter(line => line.trim().length > 0);

    this.hierarchy = {};
    const levels = {};

    let counter = 30;

    for (const line of lines) {

      const level = line.replace(/^([\s]*).*$/, '$1').length / PREFIX_LEVEL.length;

      const squareBracketEnd = line.lastIndexOf(']');
      const bracketStart = line.indexOf('(', squareBracketEnd) + 1;
      let localPath = line.substr(bracketStart, line.indexOf(')', squareBracketEnd) - bracketStart);
      let navLabel = line.substr(line.indexOf('[') + 1, line.indexOf(']') - (line.indexOf('[') + 1));

      switch (this.link_mode) {
      case 'uglyURLs':
        localPath = localPath.replace(/.html$/, '.md');
        break;

      case 'dirURLs':
        localPath += '.md';
        break;

      case 'mdURLs':
      default:
        break;
      }

      const file = this.files.find(file => file.localPath === localPath);

      if (file) {
        levels[level] = file;

        const hierarchyFrontMatter = {
          name: navLabel,
          weight: counter,
          identifier: file.id
        };

        for (let parentLevel = level - 1; parentLevel >= 0; parentLevel--) {
          const parent = levels[parentLevel];
          if (parent) {
            hierarchyFrontMatter['parent'] = parent.id;
            break;
          }
        }

        this.hierarchy[file.id] = hierarchyFrontMatter;
      }
      counter += 10;
    }

    callback();
  }

}
