'use strict';

import { Transform } from 'stream';

export class FrontMatterTransform extends Transform {

  constructor(file, linkTranslator, navigationHierarchy) {
    super();

    this.navigationHierarchy = navigationHierarchy;
    this.file = file;
    this.linkTranslator = linkTranslator;
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
    frontMatter += 'title: "' + this.file.name + '"\n';
    frontMatter += 'date: ' + this.file.modifiedTime + '\n';
    const htmlPath = this.linkTranslator.convertToRelativeMarkDownPath(this.file.localPath, '');
    if (htmlPath) {
      frontMatter += 'url: "' + htmlPath + '"\n';
    }
    if (this.file.lastAuthor) {
      frontMatter += 'author: ' + this.file.lastAuthor + '\n';
    }
    if (this.file.version) {
      frontMatter += 'version: ' + this.file.version + '\n';
    }
    frontMatter += 'id: ' + this.file.id + '\n';
    frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + this.file.id + '\n';

    if (this.navigationHierarchy[this.file.id]) {
      const navigationData = this.navigationHierarchy[this.file.id];

      frontMatter += 'menu:\n';
      frontMatter += '    main:\n';
      frontMatter += '        name: "' + navigationData.name + '"\n';
      frontMatter += '        identifier: "' + navigationData.identifier + '"\n';
      if (navigationData.parent) {
        frontMatter += '        parent: "' + navigationData.parent + '"\n';
      }
      frontMatter += '        weight: ' + navigationData.weight + '\n';
    }

    frontMatter += '---\n';

    this.push(frontMatter + this.data);

    callback();
  }

}
