import fs from 'fs';
import {Transform} from 'stream';
import {DomHandler, Parser} from 'htmlparser2';
import {findAll} from 'domutils';

export class EmbedImageFixed extends Transform {

  constructor(localPath) {
    super();

    this.localPath = localPath;
    this.json = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.json += chunk;

    callback();
  }

  async createDom(html) {
    return new Promise((resolve, reject) => {
      const handler = new DomHandler(function(error, dom) {
        if (error) {
          reject(error);
        } else {
          resolve(dom[0].children);
        }
      });
      const parser = new Parser(handler, {
        recognizeSelfClosing: true,
        recognizeCDATA: false
      });
      parser.write(html);
      parser.end();
    });
  }

  getImages(dom) {
    const elements = findAll((elem) => {
      return elem.name === 'img';
    }, dom);

    const images = [];

    for (const elem of elements) {
      images.push(elem);
    }

    return images;
  }

  fixEmbedImages(content, images, currentNo) {
    if (!currentNo) {
      currentNo = 0;
    }

    function fixUrl(src) {
      if (!src) return src;

      src = src.replace(/&amp;/g, '&');

      const url = new URL(src);
      const searchParams = url.searchParams;

      if (searchParams.get('w') && searchParams.get('h')) {
        const scale = 2;
        searchParams.set('w', String(scale * parseInt(searchParams.get('w'))));
        searchParams.set('h', String(scale * parseInt(searchParams.get('h'))));
      }

      return url.toString();
    }

    for (const item of content) {
      if (item.inlineObjectElement && item.inlineObjectElement.inlineObjectId) {
        const id = item.inlineObjectElement.inlineObjectId;

        if (this.document.inlineObjects[id]) {
          const embeddedObject = this.document.inlineObjects[id].inlineObjectProperties.embeddedObject;

          if (!embeddedObject.imageProperties) {
            const src = fixUrl(images[currentNo].attribs['src']);

            if (src) {
              embeddedObject.imageProperties = {
                contentUri: src
              };
            }
          }
        }

        currentNo++;
      }

      if (item.paragraph && item.paragraph.elements) {
        currentNo = this.fixEmbedImages(item.paragraph.elements, images, currentNo);
      }
    }

    return currentNo;
  }

  async _flush(callback) {
    const html = fs.readFileSync(this.localPath).toString();
    const dom = await this.createDom(html);

    this.document = JSON.parse(this.json);

    const images = this.getImages(dom);

    this.fixEmbedImages(this.document.body.content, images);

    this.push(JSON.stringify(this.document, null, 4));

    callback();
  }

}
