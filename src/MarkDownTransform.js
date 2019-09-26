'use strict';

import slugify from 'slugify';
import {Transform} from 'stream';

function escapeHTML(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class MarkDownTransform extends Transform {

  constructor(localPath, linkTranslator) {
    super();

    this.localPath = localPath;
    this.linkTranslator = linkTranslator;
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
    this.document = JSON.parse(this.json);

    this.styles = this.transformNamedStyles(this.document.namedStyles);
    this.lists = this.document.lists;
    this.headings = {};

    this.push(await this.convert());

    callback();
  }

  transformNamedStyles(namedStyles) {
    const styles = {};
    namedStyles.styles.forEach(namedStyle => {
      const style = {
        name: namedStyle.namedStyleType,
        fontFamily: (namedStyle.textStyle.weightedFontFamily && namedStyle.textStyle.weightedFontFamily.fontFamily) ? namedStyle.textStyle.weightedFontFamily.fontFamily : 'Arial'
      };

      styles[style.name] = style;
    });

    return styles;
  }

  async convertImageLink(url) {
    if (this.document.inlineObjects[url]) {
      const inlineObject = this.document.inlineObjects[url];

      const embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
      url = embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri;
    }

    const localPath = await this.linkTranslator.imageUrlToLocalPath(url);
    return this.linkTranslator.convertToRelativeMarkDownPath(localPath, this.localPath);
  }

  async processTos(content) {
    let text = '';
    const inSrc = false;
    const globalImageCounter = 0;
    const globalListCounters = {};

    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];

      const result = await this.processParagraph(childNo, child, inSrc, globalImageCounter, globalListCounters);
      if (result.text.trim().length > 0) {
        text += '* ' + result.text;
      }
    }

    return text;
  }

  async processParagraph(index, element, inSrc, imageCounter, listCounters) {
    if (element.tableOfContents) {
      const tableOfContentsText = await this.processTos(element.tableOfContents.content);
      return {
        text: tableOfContentsText
      };
    }

    const textElements = [];
    let pOut = '';

    const result = {};

    if (element.table) {
      textElements.push('<table>\n');

      element.table.tableRows.forEach(tableRow => {
        textElements.push('  <tr>\n');

        tableRow.tableCells.forEach(tableCell => {
          const content = tableCell.content
            .map(node => {
              const elements = node.paragraph.elements;
              return elements.map(element => {
                return element.textRun.content;
              });
            });

          textElements.push('    <td>' + content.join().trim() + '</td>\n');
        });

        textElements.push('  </tr>\n');
      });

      textElements.push('</table>\n');

    } else
    if (element.paragraph) {

      // console.log(element);
      const paragraph = element.paragraph;

      if (paragraph.paragraphStyle.namedStyleType) {
        const fontFamily = this.styles[paragraph.paragraphStyle.namedStyleType].fontFamily;
        if (fontFamily === 'Courier New') {
          textElements.push('```\n');
          result.codeParagraph = true;
        }
      }

      let paragraphTxt = '';

      for (let elementNo = 0; elementNo < paragraph.elements.length; elementNo++) {
        const element = paragraph.elements[elementNo];

        if (element.textRun) {
          let txt = element.textRun.content;
          paragraphTxt += txt;

          pOut += txt;

          element.paragraphStyle = paragraph.paragraphStyle;
          textElements.push(element);

        } else if (element.inlineObjectElement) {
          textElements.push('![](' + (await this.convertImageLink(element.inlineObjectElement.inlineObjectId)) + ')');
        } else {
          console.log(element);
        }
      }

      if (paragraph.paragraphStyle.headingId) {
        this.headings[paragraph.paragraphStyle.headingId] = slugify(paragraphTxt.trim(), { replacement: '-', lower: true });
      }

      if (paragraph.paragraphStyle.namedStyleType) {
        const fontFamily = this.styles[paragraph.paragraphStyle.namedStyleType].fontFamily;
        if (fontFamily === 'Courier New') {
          textElements.push('```\n');
        }
      }

    } else
    if (element.sectionBreak) {
      return null;
    } else {
      console.log('Unknown element', element);
    }

    if (textElements.length === 0) {
      // Isn't result empty now?
      return result;
    }

    // evb: Add source pretty too. (And abbreviations: src and srcp.)
    // process source code block:
    if (/^\s*---\s+srcp\s*$/.test(pOut) || /^\s*---\s+source pretty\s*$/.test(pOut)) {
      result.sourcePretty = 'start';
    } else if (/^\s*---\s+src\s*$/.test(pOut) || /^\s*---\s+source code\s*$/.test(pOut)) {
      result.source = 'start';
    } else if (/^\s*---\s+class\s+([^ ]+)\s*$/.test(pOut)) {
      result.inClass = 'start';
      result.className = RegExp.$1;
    } else if (/^\s*---\s*$/.test(pOut)) {
      result.source = 'end';
      result.sourcePretty = 'end';
      result.inClass = 'end';
    } else if (/^\s*---\s+jsperf\s*([^ ]+)\s*$/.test(pOut)) {
      result.text = '<iframe style="width: 100%; height: 340px; overflow: hidden; border: 0;" ' +
        'src="http://www.html5rocks.com/static/jsperfview/embed.html?id=' + RegExp.$1 +
        '"></iframe>';
    } else {

      const prefix = this.findPrefix(inSrc, element, listCounters);

      let pOut = '';
      for (let i = 0; i < textElements.length; i++) {
        pOut += await this.processTextElement(inSrc, textElements[i]);
      }

      // replace Unicode quotation marks
      pOut = pOut.replace('\u201d', '"').replace('\u201c', '"');
      result.text =   prefix + pOut;
    }

    return result;
  }

  // Add correct prefix to list items.
  findPrefix(inSrc, element, listCounters) {
    if (inSrc) {
      return '';
    }
    if (!element.paragraph) {
      return '';
    }
    let prefix = '';

    switch (element.paragraph.paragraphStyle.namedStyleType) {
      // Add a # for each heading level. No break, so we accumulate the right number.
      case 'HEADING_6': prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_5': prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_4': prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_3': prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_2': prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_1': prefix += '# '; // eslint-disable-line no-fallthrough
    }

    if (element.paragraph.bullet) {
      const nesting = element.paragraph.bullet.nestingLevel || 0;
      for (let i=0; i < nesting; i++) {
        prefix += '    ';
      }

      if (element.paragraph.bullet.listId) {
        const listId = element.paragraph.bullet.listId;
        const list = this.lists[listId];
        const key = listId + '.' + nesting;
        let counter = listCounters[key] || 0;
        if (list) {

          const listNestingLevel = list.listProperties.nestingLevels[nesting];
          switch (listNestingLevel.glyphSymbol) {
            case '-':
            case '●':
            case '○':
            case '■':
              prefix += '* ';
              break;
            default:
              // Ordered list (<ol>):
              counter++;
              listCounters[key] = counter;

              if (listNestingLevel.glyphType === 'ALPHA') {
                prefix += String.fromCharCode(64 + counter) + '. ';
              } else { // DECIMAL
                prefix += counter + '. ';
              }
          }

        }
      }
    }

    return prefix;
  }

  async processTextElement(inSrc, element) {
    if (typeof element === 'string') {
      return element;
    }

    let pOut = element.textRun.content;

    const style = Object.assign({}, element.paragraphStyle, element.textRun.textStyle);
    if (element.textRun.textStyle.namedStyleType) {
      style.fontFamily = this.styles[element.textRun.textStyle.namedStyleType].fontFamily;
    }

    function getFontFamily(style) {
      return style.fontFamily;
    }

    const font = getFontFamily(style);

    if (element.textRun.textStyle.link) {

      if (element.textRun.textStyle.link.url) {
        const localPath = await this.linkTranslator.urlToDestUrl(element.textRun.textStyle.link.url);
        const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(localPath, this.localPath);
        pOut = '[' + pOut + '](' + relativePath + ')';
      } else
      if (element.textRun.textStyle.link.headingId) {
        pOut = '[' + pOut + '](#' + element.textRun.textStyle.link.headingId + ')';
      }

      return pOut;
    }

    if (font) {
      if (!inSrc && font === 'Courier New') {
        pOut = '`' + pOut + '`';
      }
    }
    if (style.bold) {
      if (style.italic) {
        pOut = '**_' + pOut + '_**';
      } else {
        pOut = '**' + pOut + '**';
      }
    } else if (style.italic) {
      pOut = '*' + pOut + '*';
    }

    return pOut;
  }

  async convert() {
    const content = this.document.body.content;
    let text = '';
    let inSrc = false;
    let inClass = false;
    let globalImageCounter = 0;
    const globalListCounters = {};
    let srcIndent = '';

    const results = [];
    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];
      const result = await this.processParagraph(childNo, child, inSrc, globalImageCounter, globalListCounters);

      const prevResult = results.length > 0 ? results[results.length - 1] : null;

      if (prevResult && prevResult.codeParagraph && result.codeParagraph) {
        prevResult.text += result.text;
      } else {
        results.push(result);
      }
    }

    for (let childNo = 0; childNo < results.length; childNo++) {
      const result = results[childNo];

      globalImageCounter += (result && result.images) ? result.images.length : 0;
      if (result !== null) {
        if (result.sourcePretty === 'start' && !inSrc) {
          inSrc = true;
          text += '<pre class="prettyprint">\n';
        } else if (result.sourcePretty === 'end' && inSrc) {
          inSrc = false;
          text += '</pre>\n\n';
        } else if (result.source === 'start' && !inSrc) {
          inSrc = true;
          text += '<pre>\n';
        } else if (result.source === 'end' && inSrc) {
          inSrc = false;
          text += '</pre>\n\n';
        } else if (result.inClass === 'start' && !inClass) {
          inClass = true;
          text += '<div class="' + result.className + '">\n';
        } else if (result.inClass === 'end' && inClass) {
          inClass = false;
          text += '</div>\n\n';
        } else if (inClass) {
          // text += result.text;
          text += result.text + '\n\n';
        } else if (inSrc) {
          text += (srcIndent + escapeHTML(result.text) + '\n');
        } else if (result.text && result.text.length > 0) {
          if (result.codeParagraph || inSrc) {
            text += result.text;
          } else {
            text += result.text + '\n';
          }
        }
      } else if (inSrc) { // support empty lines inside source code
        text += '\n';
      }
    }

    while (text.indexOf('```\n```\n') > -1) {
      text = text.replace('```\n```\n', '');
    }

    for (let heading in this.headings) {
      while (text.indexOf(heading) > -1) {
        text = text.replace(heading, this.headings[heading]);
      }
    }

    return text;
  }

}
