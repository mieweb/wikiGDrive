'use strict';

import { Transform } from 'stream';
import {LinkTranslator} from '../LinkTranslator';
import {JsonToMarkdown} from './JsonToMarkdown';

export class MarkDownTransform extends Transform {
  private json: string;

  constructor(private localPath: string, private linkTranslator: LinkTranslator) {
    super();
    this.json = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.json += chunk;

    callback();
  }

  async _flush(callback) {
    const document = JSON.parse(this.json);

    const converter = new JsonToMarkdown(document, this.localPath, this.linkTranslator);
    const markdown = await converter.convert()
    this.push(markdown);

    callback();
  }

}
