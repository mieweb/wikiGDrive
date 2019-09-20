'use strict';

import slugify from 'slugify';

function escapeHTML(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class MarkDownConverter {

  constructor(document, options) {
    this.document = document;
    this.options = options;
    this.linkTranslator = options.linkTranslator;
    this.localPath = options.localPath;

    this.styles = this.transformNamedStyles(document.namedStyles);
    this.headings = {};
  }

  transformNamedStyles(namedStyles) {
    const styles = {};

    namedStyles.styles.forEach(namedStyle => {
      const style = {
        name: namedStyle.namedStyleType,
        fontFamily: namedStyle.textStyle.weightedFontFamily.fontFamily
      };

      styles[style.name] = style
    });

    return styles;
  }

  async convertImageLink(url) {
    if (this.document.inlineObjects[url]) {
      const inlineObject = this.document.inlineObjects[url];
      // console.log(url, JSON.stringify(inlineObject, null, 2));

      const embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
      url = embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri;
    }

    const localPath = await this.linkTranslator.imageUrlToLocalPath(url)
    return this.linkTranslator.convertToRelativePath(localPath, this.localPath);
  }

  async processTos(content) {
    let text = '';
    const inSrc = false;
    const globalImageCounter = 0;
    const globalListCounters = {};

    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];

      // console.log( JSON.stringify(child, null, 2));
      const result = await this.processParagraph(childNo, child, inSrc, globalImageCounter, globalListCounters);
      text += '* ' + result.text;
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
              })
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
        }
      }

      let paragraphTxt = '';

      for (let elementNo = 0; elementNo < paragraph.elements.length; elementNo++) {
        const element = paragraph.elements[elementNo];

        // console.log(element);

        if (element.textRun) {
          // console.log(element.textRun);
          let txt = element.textRun.content;
          paragraphTxt += txt;
          //
          // if (element.textRun.textStyle.link) {
          //   // console.log(element.textRun.textStyle.link);
          //
          //   if (element.textRun.textStyle.link.url) {
          //     txt = '[' + txt + '](' + this.convertLink(element.textRun.textStyle.link.url) + ')';
          //   } else
          //   if (element.textRun.textStyle.link.headingId) {
          //     txt = '[' + txt + '][' + element.textRun.textStyle.link.headingId + ']';
          //   }
          // }
          //
          // element.textRun.content = txt;

          pOut += txt;

          element.paragraphStyle = paragraph.paragraphStyle;
          textElements.push(element);

        } else if (element.inlineObjectElement) {
          textElements.push('![](' + (await this.convertImageLink(element.inlineObjectElement.inlineObjectId)) + ')');
        } else {
          console.log(element)
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

    const result = {};

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

      result.text = prefix + pOut;
    }

    return result;

    // Set up for real results.
    const imagePrefix = 'image_';

    // Process various types (ElementType).
    for (var i = 0; i < element.getNumChildren(); i++) {
      var t = element.getChild(i).getType();

      if (t === DocumentApp.ElementType.TABLE_ROW) {
        // do nothing: already handled TABLE_ROW
      } else if (t === DocumentApp.ElementType.TEXT) {
        // var txt=element.getChild(i);
        // pOut += txt.getText();
        // textElements.push(txt);
      } else if (t === DocumentApp.ElementType.INLINE_IMAGE) {
      } else if (t === DocumentApp.ElementType.PAGE_BREAK) {
        // ignore
      } else if (t === DocumentApp.ElementType.HORIZONTAL_RULE) {
        textElements.push('* * *\n');
      } else if (t === DocumentApp.ElementType.FOOTNOTE) {
        textElements.push(' (NOTE: ' + element.getChild(i).getFootnoteContents().getText() + ')');
      } else {
        throw 'Paragraph ' + index + ' of type ' + element.getType() + ' has an unsupported child: '
          + t + ' ' + (element.getChild(i)['getText'] ? element.getChild(i).getText() : '') + ' index=' + index;
      }
    }

    return result;
  }

  // Add correct prefix to list items.
  findPrefix(inSrc, element, listCounters) {
    let prefix = '';
    if (!inSrc) {
      if (element.paragraph) {

        switch (element.paragraph.paragraphStyle.namedStyleType) {
          // Add a # for each heading level. No break, so we accumulate the right number.
          case 'HEADING_6': prefix += '#';
          case 'HEADING_5': prefix += '#';
          case 'HEADING_4': prefix += '#';
          case 'HEADING_3': prefix += '#';
          case 'HEADING_2': prefix += '#';
          case 'HEADING_1': prefix += '# ';
          default:
        }
      } else {
        // TODO list
        // console.log('aaa', element);
      }

      // if (element.getType()===DocumentApp.ElementType.LIST_ITEM) {
      //   var listItem = element;
      //   var nesting = listItem.getNestingLevel()
      //   for (var i=0; i<nesting; i++) {
      //     prefix += "    ";
      //   }
      //   var gt = listItem.getGlyphType();
      //   // Bullet list (<ul>):
      //   if (gt === DocumentApp.GlyphType.BULLET
      //     || gt === DocumentApp.GlyphType.HOLLOW_BULLET
      //     || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
      //     prefix += "* ";
      //   } else {
      //     // Ordered list (<ol>):
      //     var key = listItem.getListId() + '.' + listItem.getNestingLevel();
      //     var counter = listCounters[key] || 0;
      //     counter++;
      //     listCounters[key] = counter;
      //     prefix += counter+". ";
      //   }
      // }

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
      // console.log(element.textRun.textStyle.link);

      if (element.textRun.textStyle.link.url) {
        pOut = '[' + pOut + '](' + await this.linkTranslator.urlToDestUrl(element.textRun.textStyle.link.url) + ')';
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
    var text = '';
    var inSrc = false;
    var inClass = false;
    var globalImageCounter = 0;
    var globalListCounters = {};
    var srcIndent = '';

    const attachments = [];

    for (let childNo = 0; childNo < content.length; childNo++) {
      const child = content[childNo];
      const result = await this.processParagraph(childNo, child, inSrc, globalImageCounter, globalListCounters);

      globalImageCounter += (result && result.images) ? result.images.length : 0;
      if (result !== null) {
        if (result.sourcePretty === 'start' && !inSrc) {
          inSrc = true;
          text += '<pre class=\"prettyprint\">\n';
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
          text += '<div class=\"' + result.className + '\">\n';
        } else if (result.inClass === 'end' && inClass) {
          inClass = false;
          text += '</div>\n\n';
        } else if (inClass) {
          text += result.text;
          // text += result.text + '\n\n';
        } else if (inSrc) {
          text += (srcIndent + escapeHTML(result.text) + '\n');
        } else if (result.text && result.text.length > 0) {
          text += result.text;
          // text += result.text + '\n\n';
        }

        if (result.images && result.images.length > 0) {
          for (let j = 0; j < result.images.length; j++) {
            attachments.push({
              fileName: result.images[j].name,
              mimeType: result.images[j].type,
              content: result.images[j].bytes
            });
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
