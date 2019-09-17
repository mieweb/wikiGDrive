'use strict';

function escapeHTML(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class MarkDownConverter {

  constructor(document, options) {
    this.document = document;
    this.options = options;
  }

  convertLink(url) {
    if (this.document.inlineObjects[url]) {
      const inlineObject = this.document.inlineObjects[url];
      // console.log(url, JSON.stringify(inlineObject, null, 2));

      const embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
      url = embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri;
    }

    for (let fileId in this.options.fileMap) {
      const file = this.options.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = '/' + file.localPath;
      }
    }

    return url;
  }

  processTos(content) {

    let text = "";
    const inSrc = false;
    const globalImageCounter = 0;
    const globalListCounters = {};

    content.forEach((child, i) => {
      // console.log( JSON.stringify(child, null, 2));
      const result = this.processParagraph(i, child, inSrc, globalImageCounter, globalListCounters);
      text += result.text;
    });

    return text;
  }

  processParagraph(index, element, inSrc, imageCounter, listCounters) {
    if (element.tableOfContents) {
      return {"text": this.processTos(element.tableOfContents.content)};
    }

    const textElements = [];
    let pOut = "";

    if (element.table) {
      textElements.push("<table>\n");

      element.table.tableRows.forEach(tableRow => {
        textElements.push("  <tr>\n");

        tableRow.tableCells.forEach(tableCell => {
          const content = tableCell.content
            .map(node => {
              const elements = node.paragraph.elements;
              return elements.map(element => {
                return element.textRun.content;
              })
            });

          textElements.push("    <td>" + content.join().trim() + "</td>\n");
        });

        textElements.push("  </tr>\n");
      });

      textElements.push("</table>\n");

    } else
    if (element.paragraph) {

      // console.log(element);
      const paragraph = element.paragraph;
      paragraph.elements.forEach(element => {
        // console.log(element);
        if (element.textRun) {
          // console.log(element.textRun);
          let txt = element.textRun.content;

          if (element.textRun.textStyle.link) {
            // console.log(element.textRun.textStyle.link);

            if (element.textRun.textStyle.link.url) {
              txt = '['+txt+']('+this.convertLink(element.textRun.textStyle.link.url)+')';
            } else
            if (element.textRun.textStyle.link.headingId) {
              txt = '['+txt+']['+element.textRun.textStyle.link.headingId+']';
            }
          }

          pOut += txt;
          textElements.push(txt);

        } else if (element.inlineObjectElement) {
          textElements.push('![]('+this.convertLink(element.inlineObjectElement.inlineObjectId)+')');
          // textElements.push('![]['+element.inlineObjectElement.inlineObjectId+']');
          // console.log('inlineObjectElement', element.inlineObjectElement);
        } else {
          console.log(element)
        }

      });

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
      result.sourcePretty = "start";
    } else if (/^\s*---\s+src\s*$/.test(pOut) || /^\s*---\s+source code\s*$/.test(pOut)) {
      result.source = "start";
    } else if (/^\s*---\s+class\s+([^ ]+)\s*$/.test(pOut)) {
      result.inClass = "start";
      result.className = RegExp.$1;
    } else if (/^\s*---\s*$/.test(pOut)) {
      result.source = "end";
      result.sourcePretty = "end";
      result.inClass = "end";
    } else if (/^\s*---\s+jsperf\s*([^ ]+)\s*$/.test(pOut)) {
      result.text = '<iframe style="width: 100%; height: 340px; overflow: hidden; border: 0;" '+
        'src="http://www.html5rocks.com/static/jsperfview/embed.html?id='+RegExp.$1+
        '"></iframe>';
    } else {

      const prefix = this.findPrefix(inSrc, element, listCounters);

      let pOut = "";
      for (let i = 0; i < textElements.length; i++) {
        pOut += this.processTextElement(inSrc, textElements[i]);
      }

      // replace Unicode quotation marks
      pOut = pOut.replace('\u201d', '"').replace('\u201c', '"');

      result.text = prefix + pOut;
    }

    return result;

    // Set up for real results.
    var imagePrefix = "image_";

    // Process various types (ElementType).
    for (var i = 0; i < element.getNumChildren(); i++) {
      var t=element.getChild(i).getType();

      if (t === DocumentApp.ElementType.TABLE_ROW) {
        // do nothing: already handled TABLE_ROW
      } else if (t === DocumentApp.ElementType.TEXT) {
        // var txt=element.getChild(i);
        // pOut += txt.getText();
        // textElements.push(txt);
      } else if (t === DocumentApp.ElementType.INLINE_IMAGE) {
        result.images = result.images || [];
        var contentType = element.getChild(i).getBlob().getContentType();
        var extension = "";
        if (/\/png$/.test(contentType)) {
          extension = ".png";
        } else if (/\/gif$/.test(contentType)) {
          extension = ".gif";
        } else if (/\/jpe?g$/.test(contentType)) {
          extension = ".jpg";
        } else {
          throw "Unsupported image type: "+contentType;
        }
        var name = imagePrefix + imageCounter + extension;
        imageCounter++;
        textElements.push('![image alt text]('+name+')');
        result.images.push( {
          "bytes": element.getChild(i).getBlob().getBytes(),
          "type": contentType,
          "name": name});
      } else if (t === DocumentApp.ElementType.PAGE_BREAK) {
        // ignore
      } else if (t === DocumentApp.ElementType.HORIZONTAL_RULE) {
        textElements.push('* * *\n');
      } else if (t === DocumentApp.ElementType.FOOTNOTE) {
        textElements.push(' (NOTE: '+element.getChild(i).getFootnoteContents().getText()+')');
      } else {
        throw "Paragraph "+index+" of type "+element.getType()+" has an unsupported child: "
        +t+" "+(element.getChild(i)["getText"] ? element.getChild(i).getText():'')+" index="+index;
      }
    }

    return result;
  }

  // Add correct prefix to list items.
  findPrefix(inSrc, element, listCounters) {
    let prefix="";
    if (!inSrc) {
      if (element.paragraph) {

        switch (element.paragraph.paragraphStyle.namedStyleType) {
          // Add a # for each heading level. No break, so we accumulate the right number.
          case 'HEADING_6': prefix+="#";
          case 'HEADING_5': prefix+="#";
          case 'HEADING_4': prefix+="#";
          case 'HEADING_3': prefix+="#";
          case 'HEADING_2': prefix+="#";
          case 'HEADING_1': prefix+="# ";
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

  processTextElement(inSrc, txt) {

    if (typeof(txt) === 'string') {
      return txt;
    }

    let pOut = txt.getText();
    if (! txt.getTextAttributeIndices) {
      return pOut;
    }

    const attrs = txt.getTextAttributeIndices();
    let lastOff = pOut.length;

    for (var i=attrs.length-1; i>=0; i--) {
      var off = attrs[i];
      var url = txt.getLinkUrl(off);
      var font = txt.getFontFamily(off);


      if (url) {  // start of link
        if (i>=1 && attrs[i-1]==off-1 && txt.getLinkUrl(attrs[i-1])===url) {
          // detect links that are in multiple pieces because of errors on formatting:
          i-=1;
          off=attrs[i];
          url=txt.getLinkUrl(off);
        }
        pOut=pOut.substring(0, off)+'['+pOut.substring(off, lastOff)+']('+url+')'+pOut.substring(lastOff);
      } else if (font) {
        if (!inSrc && font===font.COURIER_NEW) {
          while (i>=1 && txt.getFontFamily(attrs[i-1]) && txt.getFontFamily(attrs[i-1])===font.COURIER_NEW) {
            // detect fonts that are in multiple pieces because of errors on formatting:
            i-=1;
            off=attrs[i];
          }
          pOut=pOut.substring(0, off)+'`'+pOut.substring(off, lastOff)+'`'+pOut.substring(lastOff);
        }
      }
      if (txt.isBold(off)) {
        var d1 = d2 = "**";
        if (txt.isItalic(off)) {
          // edbacher: changed this to handle bold italic properly.
          d1 = "**_";
          d2 = "_**";
        }
        pOut=pOut.substring(0, off)+d1+pOut.substring(off, lastOff)+d2+pOut.substring(lastOff);
      } else if (txt.isItalic(off)) {
        pOut=pOut.substring(0, off)+'*'+pOut.substring(off, lastOff)+'*'+pOut.substring(lastOff);
      }
      lastOff=off;
    }
    return pOut;
  }



  convert() {
    const content = this.document.body.content;
    var text = "";
    var inSrc = false;
    var inClass = false;
    var globalImageCounter = 0;
    var globalListCounters = {};
    var srcIndent = "";

    const attachments = [];

    content.forEach((child, i) => {
      const result = this.processParagraph(i, child, inSrc, globalImageCounter, globalListCounters);

      globalImageCounter += (result && result.images) ? result.images.length : 0;
      if (result !== null) {
        if (result.sourcePretty==="start" && !inSrc) {
          inSrc=true;
          text+="<pre class=\"prettyprint\">\n";
        } else if (result.sourcePretty==="end" && inSrc) {
          inSrc=false;
          text+="</pre>\n\n";
        } else if (result.source==="start" && !inSrc) {
          inSrc=true;
          text+="<pre>\n";
        } else if (result.source==="end" && inSrc) {
          inSrc=false;
          text+="</pre>\n\n";
        } else if (result.inClass==="start" && !inClass) {
          inClass=true;
          text+="<div class=\""+result.className+"\">\n";
        } else if (result.inClass==="end" && inClass) {
          inClass=false;
          text+="</div>\n\n";
        } else if (inClass) {
          text+=result.text+"\n\n";
        } else if (inSrc) {
          text+=(srcIndent+escapeHTML(result.text)+"\n");
        } else if (result.text && result.text.length>0) {
          text+=result.text+"\n\n";
        }

        if (result.images && result.images.length>0) {
          for (let j = 0; j < result.images.length; j++) {
            attachments.push({
              "fileName": result.images[j].name,
              "mimeType": result.images[j].type,
              "content": result.images[j].bytes
            });
          }
        }
      } else if (inSrc) { // support empty lines inside source code
        text+='\n';
      }

    });

    return text;
  }

}
