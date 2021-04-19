import {DomHandler, Parser} from 'htmlparser2';
import {findAll} from 'domutils';
import {NodeWithChildren} from 'domhandler/lib/node';
import {Node} from 'domhandler';
import {docs_v1} from 'googleapis';
import Schema$Document = docs_v1.Schema$Document;

export async function createDom(html): Promise<Node[]> {
  return new Promise((resolve, reject) => {
    const handler = new DomHandler(function(error, dom: NodeWithChildren[]) {
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

export class GoogleListFixer {
  private readonly html: string;

  constructor(html) {
    this.html = html;
  }

  private async getOlLists(dom) {
    const elements = findAll((elem) => {
      return elem.name === 'ol';
    }, dom);

    const olLists = [];

    for (const elem of elements) {
      if (elem.attribs['class']) {
        const parts = elem.attribs['class'].split(' ');
        for (const part of parts) {
          if (part.startsWith('lst-')) {
            const parts2 = part.split('-');
            if (parts2.length > 1) {
              const listName = parts2[1].replace('_', '.');
              olLists.push(listName);
            }
          }
        }
      }
    }

    return olLists;
  }

  private async fixOlLists(docLists: {[key: string]: any}, olLists) {
    for (const listName of olLists) {
      if (docLists[listName]) {
        if (!docLists[listName].listProperties) continue;
        const listProperties = docLists[listName].listProperties;
        if (!listProperties.nestingLevels) continue;
        const nestingLevels = listProperties.nestingLevels;
        if (nestingLevels < 1) continue;

        if (nestingLevels[0].glyphType === 'GLYPH_TYPE_UNSPECIFIED') {
          nestingLevels[0].glyphType = 'ALPHA';
        }
      }
    }
  }

  async process(document: Schema$Document) {
    const dom = await createDom(this.html);
    const images = [];
    const elements = findAll((elem) => {
      return elem.name === 'img';
    }, dom);

    for (const elem of elements) {
      images.push(elem);
    }

    const olLists = await this.getOlLists(dom);
    await this.fixOlLists(document.lists, olLists);

    return document;
  }

}
