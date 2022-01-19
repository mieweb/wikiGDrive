import {docs_v1} from 'googleapis';
import Schema$Document = docs_v1.Schema$Document;
import {xml2js} from 'xml-js';
import {traverseObject} from '../utils/extractDocumentLinks';

export class GoogleListFixer {
  private readonly xml: string;

  constructor(xml) {
    this.xml = xml;
  }

  private async getOlLists(oodoc) {
    const elements = [];
    // findAll((elem) => {
    //   return elem.name === 'ol';
    // }, dom);
    traverseObject(oodoc, (obj) => {
      if (typeof obj === 'object') {
        if ('draw:image' === obj['name'] && obj['attributes'] && obj['attributes']['xlink:href']) {
          // elements.push(obj);
        }
      }
      return true;
    });

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
    const oodoc = xml2js(this.xml, { alwaysArray: true });
    const images = [];

    const elements = [];
    traverseObject(oodoc, (obj) => {
      if (typeof obj === 'object') {
        if ('draw:image' === obj['name'] && obj['attributes'] && obj['attributes']['xlink:href']) {
          elements.push(obj);
        }
      }
      return true;
    });

    for (const elem of elements) {
      images.push(elem);
    }

    // const olLists = await this.getOlLists(oodoc);
    // await this.fixOlLists(document.lists, olLists);

    return document;
  }

}
