import {DomHandler, Parser} from 'htmlparser2';
import {findAll} from 'domutils';
import {NodeWithChildren} from 'domhandler/lib/node';
import {Node} from 'domhandler';

export class GoogleListFixer {
  private readonly html: string;
  private json: string;
  private document: any;

  constructor(html) {
    this.html = html;
    this.json = '';
  }

  async createDom(html): Promise<Node[]> {
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

  async getOlLists() {
    const dom = await this.createDom(this.html);
    this.document = JSON.parse(this.json);

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

  async fixOlLists(content: any[], docLists, olLists) {
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

}
