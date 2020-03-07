'use strict';

import {Writable} from 'stream';

export class StringWritable extends Writable {

  constructor() {
    super();
    this.content = '';
  }

  _write(chunk, encoding, callback) {
    this.content += chunk.toString();

    callback();
  }

  getString() {
    return this.content;
  }

}
