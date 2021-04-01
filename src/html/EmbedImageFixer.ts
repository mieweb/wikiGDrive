import {DomHandler, Parser} from 'htmlparser2';
import {findAll} from 'domutils';
import {Node} from 'domhandler';

export class EmbedImageFixer {
  private readonly images: any[];
  private readonly html: string;
  private document: any;

  constructor(html: string, images: any[]) {
    this.html = html;
    this.images = images;
  }

  async createDom(html): Promise<Node[]> {
    return new Promise((resolve, reject) => {
      const handler = new DomHandler((error, dom) => {
        if (error) {
          reject(error);
        } else {
          resolve(dom[0]['children']);
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

  fixEmbedImages(content: any[], images, currentNo = 0) {
    const fixUrl = (src) => {
      if (!src) return src;

      if (this.images[src]) {
        return this.images[src] + '.md5';
      }

      if (!src.startsWith('http')) {
        return src;
      }

      src = src.replace(/&amp;/g, '&');

      const url = new URL(src);
      const searchParams = url.searchParams;

      if (searchParams.get('w') && searchParams.get('h')) {
        const scale = 2;
        searchParams.set('w', String(scale * parseInt(searchParams.get('w'))));
        searchParams.set('h', String(scale * parseInt(searchParams.get('h'))));
      }

      return url.toString();
    };

    for (const item of content) {
      if (item.inlineObjectElement && item.inlineObjectElement.inlineObjectId) {
        const id = item.inlineObjectElement.inlineObjectId;

        if (this.document.inlineObjects[id]) {
          const embeddedObject = this.document.inlineObjects[id].inlineObjectProperties.embeddedObject;
          const src = fixUrl(images[currentNo].attribs['src']);

          if (embeddedObject.imageProperties && embeddedObject.imageProperties.contentUri && embeddedObject.imageProperties.contentUri.indexOf('googleusercontent') > -1) {
            if (src && src.endsWith('.md5')) {
              // const md5 = src.replace('.md5', '');
              embeddedObject.imageProperties = {
                contentUri: src
              };
            }
          } else
          if (!embeddedObject.imageProperties) {
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

  async process(document) {
    const dom = await this.createDom(this.html);
    const images = [];
    const elements = findAll((elem) => {
      return elem.name === 'img';
    }, dom);

    for (const elem of elements) {
      images.push(elem);
    }

    this.document = document;

    this.fixEmbedImages(this.document.body.content, images);

    return this.document;
  }

}
