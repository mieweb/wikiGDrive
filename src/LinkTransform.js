'use strict';

const { Transform } = require('stream');
const xmldoc = require('xmldoc');

export class LinkTransform extends Transform {

  constructor(options) {
    super(options);
    this.content = '';
    this.options = options;
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.content += chunk;

    callback();
  }

  _flush(callback) {
    const document = new xmldoc.XmlDocument(this.content);

    const processChild = (child) => {

      if (child.attr['xlink:href']) {
        for (let fileId in this.options.fileMap) {
          const file = this.options.fileMap[fileId];
          if (child.attr['xlink:href'].indexOf(fileId) > -1) {
            child.attr['xlink:href'] = file.localPath;
          }
        }
      }

      child.eachChild((child, index, array) => {
        processChild(child);
      });
    };

    document.eachChild((child, index, array) => {
      processChild(child);
    });

    this.push(document.toString());

    callback();
  }

}
