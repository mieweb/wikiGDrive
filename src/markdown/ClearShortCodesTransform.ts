'use strict';

import { Transform } from 'stream';

export class ClearShortCodesTransform extends Transform {
  private readonly active: boolean;
  private data: string;

  constructor(active) {
    super();

    this.active = !!active;
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
    let data = this.data;

    if (this.active) {
      data = data.replace(/{{[^}]+}}/g, '');
    }

    this.push(data);

    callback();
  }

}
