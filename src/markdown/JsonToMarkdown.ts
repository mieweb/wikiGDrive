import slugify from 'slugify';

export const PREFIX_LEVEL = '    ';

function fixBold(text) {
  const lines = text.split('\n');

  const retVal = [];
  for (const line of lines) {
    const count = line.split('**').length - 1;
    if (count % 2 === 1) {
      retVal.push(line + '**');
    } else {
      retVal.push(line);
    }
  }

  return retVal.map(line => {
    while (line.endsWith('****')) {
      line = line.substring(0, line.length - '****'.length);
    }
    while (line.endsWith('<strong></strong>')) {
      line = line.substring(0, line.length - '<strong></strong>'.length);
    }
    return line;
  }).join('\n');
}

function wrapWith(wrapper, text, wrapper2) {
  if (!text) return text;

  let enterMode = false;
  if (text.endsWith('\n')) {
    enterMode = true;
  }

  if (enterMode) {
    text = text.substring(0, text.length - 1);
    text = wrapper + text + wrapper2;
    text += '\n';
  } else {
    text = wrapper + text + wrapper2;
  }

  return text;
}

interface ProcessParagraphResult {
  listParagraph: boolean,
  codeParagraph: boolean,
  headerParagraph: boolean,
  text: string
}

interface DocStyle {
  fontFamily: string;
}

interface DocStyles {
  [k: string]: DocStyle;
}

interface DocHeadings {
  [k: string]: string;
}

interface DocNestingLevel {
  glyphSymbol: string;
  glyphType: string;
}

interface DocNestingLevels {
  [k: string]: DocNestingLevel;
}

interface DocListProperties {
  nestingLevels: DocNestingLevels;
}

interface DocList {
  listProperties: DocListProperties;
}

interface DocLists {
  [k: string]: DocList;
}

export class JsonToMarkdown {

  private styles: DocStyles;
  private headings: DocHeadings;
  private lists: DocLists;
  private inRawHtml = false;

  constructor(private document) {
  }

  async convert(): Promise<string> {
    this.styles = this.transformNamedStyles(this.document.namedStyles);
    this.lists = this.document.lists;
    this.headings = {};

    const globalListCounters = {};

    let text = await this.elementsToText(this.document.body.content, globalListCounters);

    text = this.processMacros(text);
    text = this.fixBlockMacros(text);
    text = this.fixQuotes(text);

    /*eslint no-control-regex: "off"*/
    text = text.replace(/\x0b/g, ' ');

    return text;
  }

  processMacros(text) {
    const blocks = text.split('```');

    const retVal = [];
    blocks.forEach((block, idx) => {
      let newBlock = '';
      if (idx % 2 == 0) {
        let prevChar = '';
        for (let colNo = 0; colNo < block.length; colNo++) {
          let char = block.substring(colNo, 1);

          if (prevChar === '\\') {
            switch (char) {
              case '\\':
                newBlock += char;
                char = '';
                break;
              case '{':
                newBlock += '\\{';
                break;
              case '}':
                newBlock += '\\}';
                break;
              default:
                newBlock += char;
            }
          } else {
            switch (char) {
              case '\\':
                break;
              default:
                newBlock += char;
            }
          }

          prevChar = char;
        }

        // block = block.replace(/{?{/g, '{{% ');
        // block = block.replace(/ ?}?}/g, ' %}}');
        // block = block.replace(/ \/ %}}/g, ' /%}}');
      } else {
        newBlock = block;
      }

      retVal.push(newBlock);
    });

    return retVal.join('```');
  }

  fixQuotes(text) {
    return text
      .replace(/’/g, '\'')
      .replace(/“/g, '"')
      .replace(/”/g, '"');
  }

  static convertHtmlSimpleTags(pOut) {
    pOut = pOut.replace(/<strong><em>/g, '**_');
    pOut = pOut.replace(/([\s]*)<\/em><\/strong>/g, '_**$1');
    pOut = pOut.replace(/<strong>/g, '**');
    pOut = pOut.replace(/([\s]*)<\/strong>/g, '**$1');
    pOut = pOut.replace(/<em>/g, '*');
    pOut = pOut.replace(/([\s]*)<\/em>/g, '*$1');
    return pOut;
  }

  fixBlockMacros(text) {
    const lines = text.split('\n').map(line => {
      let idxStart;
      let idxEnd = 0;

      while ((idxStart = line.indexOf('{{% ', idxEnd)) > -1) {
        idxEnd = line.indexOf(' %}}', idxStart);
        if (idxEnd > -1) {
          const parts = [
            line.substring(0, idxStart),
            line.substring(idxStart, -idxStart + idxEnd + ' %}}'.length),
            line.substring(idxEnd + ' %}}'.length)
          ];

          if (parts[1].startsWith('{{% /')) {
            line = parts[0] + parts[1] + '\n' + parts[2];
            idxEnd++;
          } else {
            const idxOfClosing = line.indexOf(parts[1].replace('{{% ', '{{% /'), idxEnd);

            if (idxOfClosing > -1) {
              const parts = [
                line.substring(0, idxStart),
                line.substring(idxStart, -idxStart + idxEnd + ' %}}'.length),
                line.substring(idxEnd + ' %}}'.length, -(idxEnd + ' %}}'.length) + idxOfClosing),
                line.substring(idxOfClosing)
              ];

              parts[2] = JsonToMarkdown.convertHtmlSimpleTags(parts[2]);

              line = parts[0] + '\n\n' + parts[1] + parts[2] + parts[3];
              idxEnd += 2;
            }
          }
        } else {
          break;
        }
      }

      return line;
    });

    return lines.join('\n');
  }

  async elementsToText(content, globalListCounters) {
    const results = [];
    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];
      const result = await this.processParagraph(child, globalListCounters);

      const prevResult = results.length > 0 ? results[results.length - 1] : null;

      if (prevResult && prevResult.codeParagraph && result.codeParagraph) {
        prevResult.text += result.text;
      } else {
        results.push(result);
      }
    }

    let text = '';
    let prevParaIsList = false;
    for (let childNo = 0; childNo < results.length; childNo++) {
      const result = results[childNo];

      let currentParaIsList = false;

      let line = '';

      if (result !== null) {
        if (result.text && result.text.length > 0) {
          if (result.listParagraph) {
            currentParaIsList = true;
            line = result.text + '\n';
          } else
          if (result.headerParagraph) {
            line = result.text + '\n\n';
          } else
          if (result.codeParagraph) {
            line = result.text;
          } else {
            line = result.text + '\n';
          }
        }
      }

      if (!currentParaIsList && prevParaIsList) {
        line = '\n' + line;
      }

      text += line;
      prevParaIsList = currentParaIsList;
    }

    while (text.indexOf('```\n```\n') > -1) {
      text = text.replace('```\n```\n', '');
    }

    for (const heading in this.headings) {
      while (text.indexOf(heading) > -1) {
        text = text.replace(heading, this.headings[heading]);
      }
    }

    return text;
  }

  async processTextElement(element) {
    if (typeof element === 'string') {
      return element;
    }

    let pOut = element.textRun.content;

    if (pOut === '\n' && element.textRun.textStyle.italic) {
      return '';
    }

    if (pOut.indexOf('{{rawhtml}}') > -1) {
      this.inRawHtml = true;
      return pOut;
    }
    if (pOut.indexOf('{{/rawhtml}}') > -1) {
      this.inRawHtml = false;
      return pOut;
    }
    if (this.inRawHtml) {
      return pOut;
    }

    if (pOut.substring(0, 3) === '{{%' && element.textRun.textStyle.italic) {
      return pOut;
    }

    const style = Object.assign({}, element.paragraphStyle, element.textRun.textStyle);
    if (element.textRun.textStyle.namedStyleType) {
      style.fontFamily = this.styles[element.textRun.textStyle.namedStyleType].fontFamily;
    }

    function getFontFamily(style) {
      if (style.weightedFontFamily) {
        return style.weightedFontFamily.fontFamily;
      }
      return style.fontFamily;
    }

    const font = getFontFamily(style);

    if (element.textRun.textStyle.link) {

      if (element.textRun.textStyle.link.url) {
        pOut = '[' + pOut + '](' + element.textRun.textStyle.link.url + ')';
      } else
      if (element.textRun.textStyle.link.headingId) {
        pOut = '[' + pOut + '](#' + element.textRun.textStyle.link.headingId + ')';
      }

      return pOut;
    }

    if (font) {
      if (font === 'Courier New' || font === 'Courier') {
        pOut = '`' + pOut + '`';
      }
    }
    if (style.bold) {
      if (style.italic) {
        pOut = wrapWith('<strong><em>', pOut, '</em></strong>');
      } else {
        pOut = wrapWith('<strong>', pOut, '</strong>');
      }
    } else if (style.italic) {
      pOut = wrapWith('<em>', pOut, '</em>');
    }

    return pOut;
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

  async processTos(content) {
    let text = '';
    const globalListCounters = {};

    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];

      const result = await this.processParagraph(child, globalListCounters);
      if (result.text.trim().length > 0) {
        text += '* ' + result.text;
      }
    }

    return text;
  }

  async processParagraph(element, listCounters): Promise<ProcessParagraphResult> {
    if (element.tableOfContents) {
      const tableOfContentsText = await this.processTos(element.tableOfContents.content);
      return {
        listParagraph: false,
        codeParagraph: false,
        headerParagraph: false,
        text: tableOfContentsText
      };
    }

    const textElements = [];

    const result: ProcessParagraphResult = {
      listParagraph: false,
      codeParagraph: false,
      headerParagraph: false,
      text: ''
    };

    if (element.table) {
      textElements.push('<table>\n');

      for (const tableRow of element.table.tableRows) {
        textElements.push('  <tr>\n');

        for (let cellNo = 0; cellNo < tableRow.tableCells.length; cellNo++) {
          const tableCell = tableRow.tableCells[cellNo];
          let tableParams = '';
          if (tableCell && tableCell.tableCellStyle) {
            if (tableCell.tableCellStyle.columnSpan > 1) {
              tableParams += ' colspan="' + tableCell.tableCellStyle.columnSpan + '"';
              cellNo += tableCell.tableCellStyle.columnSpan - 1;
            }
          }

          const text = await this.elementsToText(tableCell.content, listCounters);
          const trimmedText = text.trim();
          if (trimmedText.indexOf('\n') >= 0) {
            textElements.push('    <td' + tableParams + '>\n');
            textElements.push(trimmedText + '\n');  // remove trailing and leading whitespace since markdown does not like it. https://github.com/mieweb/wikiGDrive/issues/65
            textElements.push('    </td>\n');
          } else {
            textElements.push('    <td' + tableParams + '>' + trimmedText + '</td>\n');
          }

        }

        textElements.push('  </tr>\n');
      }

      textElements.push('</table>\n');

    } else
    if (element.paragraph) {

      const paragraph = element.paragraph;

      if (paragraph.paragraphStyle?.namedStyleType) {
        const fontFamily = this.styles[paragraph.paragraphStyle.namedStyleType].fontFamily;
        if (fontFamily === 'Courier New' || fontFamily === 'Courier') {
          textElements.push('```\n');
          result.codeParagraph = true;
        }
      }

      let paragraphTxt = '';

      for (let elementNo = 0; elementNo < paragraph.elements.length; elementNo++) {
        const element = paragraph.elements[elementNo];

        if (element.textRun) {
          paragraphTxt += element.textRun.content;

          element.paragraphStyle = paragraph.paragraphStyle;
          textElements.push(element);
        } else
        if (element.inlineObjectElement) {
          const imageLink = element.inlineObjectElement.src;
          if (imageLink) {
            if (imageLink.endsWith('.svg')) {
              textElements.push('<object type="image/svg+xml" data="' + imageLink + '">' +
                '<img src="' + imageLink + '" />' +
                '</object>');
            } else {
              textElements.push('![](' + (imageLink) + ')');
            }
          } else {
            const uri = this.getLinkFromId(element.inlineObjectElement.inlineObjectId);
            if (uri) {
              textElements.push('![](' + (uri) + ')');
            }
          }
        }
      }

      if (paragraph.paragraphStyle?.headingId) {
        this.headings[paragraph.paragraphStyle.headingId] = slugify(paragraphTxt.trim(), { replacement: '-', lower: true, remove: /[#*+~.()'"!:@]/g });
      }

      if (paragraph.paragraphStyle?.namedStyleType) {
        const fontFamily = this.styles[paragraph.paragraphStyle.namedStyleType].fontFamily;
        if (fontFamily === 'Courier New' || fontFamily === 'Courier') {
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

    const prefix = this.findPrefix(element, listCounters);

    let pOut = '';
    const processed = [];
    for (let i = 0; i < textElements.length; i++) {
      processed.push(await this.processTextElement(textElements[i]));
    }
    pOut = processed.join('');

    // replace Unicode quotation marks
    pOut = pOut.replace('\u201d', '"').replace('\u201c', '"');

    if (this.inRawHtml) {
      result.text = prefix + pOut;
      return result;
    }

    pOut = fixBold(pOut);

    if (prefix.match(/^#+ /)) {
      if (pOut.startsWith('<strong>') && pOut.trim().endsWith('</strong>')) {
        pOut = pOut.substring('<strong>'.length);
        pOut = pOut.substring(0, pOut.lastIndexOf('</strong>'));
      }
    }

    if (prefix.trim() === '*') {
      const parts = pOut.split('**');

      if (parts.length > 1) {
        pOut = '';
        parts.forEach((part, idx) => {
          pOut += part;
          if (idx % 2) {
            pOut += '</strong>';
          } else {
            pOut += '<strong>';
          }
        });

        if (parts.length % 2) {
          pOut += '</strong>';
        }

        while (pOut.indexOf('<strong></strong>') > -1) {
          pOut = pOut.replace('<strong></strong>', '');
        }
      }
    }

    if (!prefix) {
      pOut = pOut.replace(/<strong><em>/g, '**_');
      pOut = pOut.replace(/<\/em><\/strong>/g, '_**');
      pOut = pOut.replace(/<strong>/g, '**');
      pOut = pOut.replace(/<\/strong>/g, '**');
      pOut = pOut.replace(/<em>/g, '*');
      pOut = pOut.replace(/<\/em>/g, '*');
    }

    if (prefix && !prefix.trim().startsWith('#')) {
      pOut = pOut.replace(/\n$/, '');
      result.listParagraph = true;
    } else if (prefix && prefix.trim().startsWith('#')) {
      pOut = pOut.replace(/\n$/, '');
      result.headerParagraph = true;
    }

    result.text = prefix + pOut;

    return result;
  }

  // Add correct prefix to list items.
  findPrefix(element, listCounters) {
    if (!element.paragraph) {
      return '';
    }
    let prefix = '';

    switch (element.paragraph.paragraphStyle?.namedStyleType) {
      // Add a # for each heading level. No break, so we accumulate the right number.
      case 'HEADING_6':
        prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_5':
        prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_4':
        prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_3':
        prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_2':
        prefix += '#'; // eslint-disable-line no-fallthrough
      case 'HEADING_1':
        prefix += '# '; // eslint-disable-line no-fallthrough
    }

    if (element.paragraph.bullet) {
      const nesting = element.paragraph.bullet.nestingLevel || 0;
      for (let i = 0; i < nesting; i++) {
        prefix += PREFIX_LEVEL;
      }

      if (element.paragraph.bullet.listId) {
        const listId = element.paragraph.bullet.listId;
        const list = this.lists[listId];
        const key = listId + '.' + nesting;
        let counter = listCounters[key] || 0;
        if (list) {

          const {glyphSymbol, glyphType} = list.listProperties.nestingLevels[nesting];
          switch (glyphSymbol) {
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

              switch (glyphType) {
                case 'ALPHA':
                case 'UPPER_ALPHA':
                  // prefix += String.fromCharCode(64 + counter) + '. '; // Hugo doesn't accept alpha
                  prefix += counter + '. ';
                  break;

                case 'DECIMAL':
                case 'ROMAN':
                case 'UPPER_ROMAN':
                  prefix += counter + '. ';
                  break;

                case 'GLYPH_TYPE_UNSPECIFIED':
                default:
                  prefix += '* ';
                  break;
              }
          }
        }
      }
    }

    return prefix;
  }

  private getLinkFromId(inlineObjectId: string) {
    const inlineObject = this.document.inlineObjects[inlineObjectId];
    if (inlineObject) {
      const sourceUri = inlineObject?.inlineObjectProperties?.embeddedObject?.imageProperties?.sourceUri;
      if (sourceUri) {
        return sourceUri;
      }
      const contentUri = inlineObject?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
      if (contentUri) {
        return contentUri;
      }
    }
    return null;
  }
}
