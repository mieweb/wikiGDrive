'use strict';

import { Transform } from 'stream';

export class FrontMatterTransform extends Transform {

  constructor(file) {
    super();

    this.file = file;
    this.data = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.data += chunk;

    callback();
  }

  async _flush(callback) {
    let frontMatter = '---\n';
    frontMatter += 'title: ' + this.file.name + '\n';
    frontMatter += 'date: ' + this.file.modifiedTime + '\n';
    if (this.file.lastAuthor) {
      frontMatter += 'author: ' + this.file.lastAuthor + '\n';
    }
    frontMatter += 'id: ' + this.file.id + '\n';
    frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + this.file.id + '\n';
    frontMatter += '---\n';

    this.push(frontMatter + this.data);

    callback();
  }

}
