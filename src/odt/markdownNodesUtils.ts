import {Style, TextProperty} from './LibreOffice.ts';
import {inchesToPixels, spaces} from './utils.ts';
import {applyRewriteRule, RewriteRule} from './applyRewriteRule.ts';
import {type MarkdownNode, MarkdownTagNode, OutputMode, TagPayload} from './MarkdownNodes.ts';

export function debugChunkToText(chunk: MarkdownNode) {
  if (chunk.isTag === false) {
    return chunk.text;
  }

  return chunk.tag;
}

export function addComment(chunk: MarkdownTagNode, comment: string) {
  if (chunk.comment) {
    chunk.comment += ' ' + comment;
  } else {
    chunk.comment = comment;
  }
}

export function textStyleToString(textProperty: TextProperty) {
  if (!textProperty) {
    return '';
  }
  let styleTxt = '';

  if (textProperty.fontColor) {
    styleTxt += ` fill: ${textProperty.fontColor};`;
  }
  if (textProperty.fontSize) {
    // styleTxt += ` font-size: ${inchesToMm(textProperty.fontSize)}mm;`;
  }

  return styleTxt;
}

function styleToString(style: Style) {
  let styleTxt = '';
  if (style?.graphicProperties) {
    const graphicProperties = style?.graphicProperties;
    // if (graphicProperties.stroke) {
    //   styleTxt += ` stroke: ${graphicProperties.stroke};`;
    // }
    if (graphicProperties.strokeWidth) {
      styleTxt += ` stroke-width: ${graphicProperties.strokeWidth};`;
    }
    if (graphicProperties.strokeColor) {
      styleTxt += ` stroke: ${graphicProperties.strokeColor};`;
    }
    if (graphicProperties.strokeLinejoin) {
      styleTxt += ` stroke-line-join: ${graphicProperties.strokeLinejoin};`;
    }
    // if (graphicProperties.fill) {
    //   styleTxt += ` fill: ${graphicProperties.fill};`;
    // }
    if (graphicProperties.fillColor) {
      styleTxt += ` fill: ${graphicProperties.fillColor};`;
    }
  }

  if (!styleTxt) {
    return 'fill: transparent;';
  }

  return styleTxt;
}


function buildSvgStart(payload: TagPayload) {
  const width = payload.width;
  const height = payload.height;


  let retVal = `<svg style="${payload.styleTxt || ''}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">\n`;
  const styleTxt = styleToString(payload?.style);
  if (styleTxt) {
    retVal += `<style>* { ${styleTxt} }</style>\n`;
  }
  return retVal;
}

interface ToTextContext {
  mode: OutputMode;
  rules: RewriteRule[];
  onlyNotTag?: boolean;
  inListItem?: boolean;
}

function addLiNumbers(chunk: MarkdownTagNode, ctx: {addLiIndents?: boolean}, innerText: string) {
  if (!ctx.addLiIndents) {
    return innerText;
  }
  if (!chunk.isTag) {
    return innerText;
  }
  if (chunk.tag !== 'LI') {
    return innerText;
  }

  let noPara = false;
  if (chunk.children.length > 0 && chunk.children[0].isTag && chunk.children[0].tag === 'UL') { // No para, no symbol
    noPara = true;
    // return innerText;
  }

  if (!chunk.payload.listLevel) {
    // return innerText;
  }

  // const level = (chunk.payload.listLevel || 1) - 1;
  const level = 0;

  if (!chunk.payload.bullet && !(chunk.payload.number > 0) && level === 0) {
    // return innerText;
  }

  // let indent = spaces(level * 4); GDocs not fully compatible
  // if (chunk.payload.style?.paragraphProperties?.marginLeft) {
  //   indent = spaces(inchesToSpaces(chunk.payload.style?.paragraphProperties?.marginLeft) - 4);
  // }
  // const indent = spaces(level * 3);
  const listStr = chunk.payload.bullet ? '* ' : chunk.payload.number > 0 ? `${chunk.payload.number}. ` : '';
  // const firstStr = indent + listStr;
  // const otherStr = indent + spaces(listStr.length);

  const firstStr = listStr;
  const otherStr = spaces(listStr.length || 3);

  return innerText
    .split('\n')
    .map((line, idx) => {
      if (noPara) {
        return otherStr + '' + line;
      }
      if (idx === 0) {
        return firstStr + '' + line;
      }
      return otherStr + '' + line;
    })
    .join('\n') + '\n';

/*  let prevEmptyLine = 1;
  for (let position2 = ctx.nodeIdx + 1; position2 < chunk.parent.children.length; position2++) {
    const chunk2 = chunk.parent.children[position2];
    if (chunk2.isTag === true && chunk2.tag === '/P' && chunk.mode === 'md') {
      position += position2 - position - 1;
      break;
    }

    if (chunk2.isTag === true && ['BR/'].indexOf(chunk2.tag) > -1) {
      prevEmptyLine = 2;
      continue;
    }

    if (chunk2.isTag === false && chunk2.text.startsWith('{{% ') && chunk2.text.endsWith(' %}}')) {
      const innerText = chunk2.text.substring(3, chunk2.text.length - 3);
      if (innerText.indexOf(' %}}') === -1) {
        continue;
      }
    }

    if (prevEmptyLine > 0) {
      chunk.parent.children.splice(position2, 0, {
        isTag: false,
        text: prevEmptyLine === 1 ? firstStr : otherStr,
        comment: `addIndentsAndBullets.ts: Indent (${chunk.payload.bullet ? 'bullet' : 'number ' + chunk.payload.number}), level: ` + level + ', prevEmptyLine: ' + (!chunk.payload.bullet && !(chunk.payload.number > 0) && level === 0)
      });
      prevEmptyLine = 0;
      position2++;
      return innerText;
    }
  }
 */
}

function chunkToText(chunk: MarkdownNode, ctx: ToTextContext) {
  ctx = Object.assign({ rules: [], mode: 'md' }, ctx);

  if (chunk.isTag === false) {
    return chunk.text;
  }

  if (ctx.inListItem) {
    switch (chunk.tag) {
      case 'B':
        return '<strong>' + chunksToText(chunk.children, ctx) + '</strong>';
      case 'I':
        return '<em>' + chunksToText(chunk.children, ctx) + '</em>';
      case 'BI':
        return '<strong><em>' + chunksToText(chunk.children, ctx) + '</em></strong>\'';
    }
  }

  switch (ctx.mode) {
    case 'raw':
      switch (chunk.tag) {
        case 'BODY':
          return chunksToText(chunk.children, ctx);
        case 'P':
          return chunksToText(chunk.children, ctx) + '\n';
        case 'PRE':
          return chunksToText(chunk.children, ctx) + '\n';
        case 'BR/':
          return '\n';
        case 'EOL/':
          return '\n';
        case 'EMPTY_LINE/':
          return '\n';
        case 'BLANK/':
          return '';
        default:
          return chunksToText(chunk.children, ctx);
      }
      break;
    case 'md':
      switch (chunk.tag) {
        case 'BODY':
          return chunksToText(chunk.children, ctx);
        case 'P':
          return chunksToText(chunk.children, ctx);
        case 'BR/':
          return '  \n';
        case 'EOL/':
          return '\n';
        case 'EMPTY_LINE/':
          return '\n';
        case 'PRE':
          return '\n```'+ (chunk.payload?.lang || '') +'\n' + chunksToText(chunk.children, ctx) + '\n```\n';
        case 'CODE':
          return '`' + chunksToText(chunk.children, ctx) + '`';
        case 'I':
          return '*' + chunksToText(chunk.children, ctx) + '*';
        case 'BI':
          return '**_' + chunksToText(chunk.children, ctx) + '_**';
        case 'B':
          return '**' + chunksToText(chunk.children, ctx) + '**';
        case 'H1':
          return '# ' + chunksToText(chunk.children, ctx) + '\n';
        case 'H2':
          return '## ' + chunksToText(chunk.children, ctx) + '\n';
        case 'H3':
          return '### ' + chunksToText(chunk.children, ctx) + '\n';
        case 'H4':
          return '#### ' + chunksToText(chunk.children, ctx) + '\n';
        case 'HR/':
          return '\n___\n';
        case 'A':
          return '[' + chunksToText(chunk.children, ctx) + `](${chunk.payload.href})`;
        case 'SVG/':
          return `![](${chunk.payload.href})`;
        case 'IMG/':
          return `![](${chunk.payload.href})`;
        case 'EMB_SVG':
          return buildSvgStart(chunk.payload);
        case 'HTML_MODE/': // TODO
          return chunksToText(chunk.children, { ...ctx, mode: 'html' }) + '\n';
        case 'LI': // TODO
          return addLiNumbers(chunk, ctx, chunksToText(chunk.children, { ...ctx, inListItem: true }));
        default:
          return chunksToText(chunk.children, ctx);
      }
      break;
    case 'html':
      switch (chunk.tag) {
        case 'BODY':
          return chunksToText(chunk.children, ctx);
        case 'BR/':
          return '\n';
        case 'EOL/':
          return '\n';
        case 'EMPTY_LINE/':
          return '<br />';
        case 'HR/':
          return '<hr />';
        case 'B':
          return '<strong>' + chunksToText(chunk.children, ctx) + '</strong>';
        case 'I':
          return '<em>' + chunksToText(chunk.children, ctx) + '</em>';
        case 'BI':
          return '<strong><em>' + chunksToText(chunk.children, ctx) + '</em></strong>\'';
        case 'H1':
          return '<h1>' + chunksToText(chunk.children, ctx) + '</h1>';
        case 'H2':
          return '<h2>' + chunksToText(chunk.children, ctx) + '</h2>';
        case 'H3':
          return '<h3>' + chunksToText(chunk.children, ctx) + '</h3>';
        case 'H4':
          return '<h4>' + chunksToText(chunk.children, ctx) + '</h4>';
        case 'P':
          return '<p>' + chunksToText(chunk.children, ctx) + '</p>';
        case 'CODE':
          return '<code>' + chunksToText(chunk.children, ctx) + '</code>';
        case 'PRE':
          return '<pre>' + chunksToText(chunk.children, ctx) + '</pre>';
        case 'UL':
          if (chunk.payload.number > 0) {
            return '<ol>' + chunksToText(chunk.children, ctx) + '</ol>';
          } else {
            return '<ul>' + chunksToText(chunk.children, ctx) + '</ul>';
          }
        case 'LI':
          return '<li>' + chunksToText(chunk.children, ctx) + '</li>';
        case 'A':
          return `<a href="${chunk.payload.href}">` + chunksToText(chunk.children, ctx) + '</a>';
        case 'TABLE':
          return '\n<table>\n' + chunksToText(chunk.children, ctx) + '\n</table>\n';
        case 'TR':
          return '<tr>\n' + chunksToText(chunk.children, ctx) + '</tr>\n';
        case 'TD':
          return '<td>' + chunksToText(chunk.children, ctx) + '</td>\n';
        case 'TOC':
          return chunksToText(chunk.children, ctx);
        case 'SVG/':
          return `<object type="image/svg+xml" data="${chunk.payload.href}" ></object>`;
        case 'IMG/':
          return `<img src="${chunk.payload.href}" />`;
        case 'EMB_SVG':
          return buildSvgStart(chunk.payload) + chunksToText(chunk.children, ctx) + '</svg>\n';
        case 'EMB_SVG_G':
          {
            if (chunk.payload.x || chunk.payload.y) {
              const transformStr = `transform="translate(${chunk.payload.x || 0}, ${chunk.payload.y || 0})"`;
              return `<g ${transformStr}>\n` + chunksToText(chunk.children, ctx) + '</g>\n';
            }
            return '<g>\n' + chunksToText(chunk.children, ctx) + '</g>\n';
          }
        case 'EMB_SVG_P/':
          return `<path d="${chunk.payload.pathD}" transform="${chunk.payload.transform}" style="${styleToString(chunk.payload?.style)}" ></path>\n`;
        case 'EMB_SVG_TEXT':
          return `<text style="${chunk.payload.styleTxt || ''}" x="0" dy="100%" >` + chunksToText(chunk.children, ctx) + '</text>\n';
        case 'EMB_SVG_TSPAN':
          {
            const fontSize = inchesToPixels(chunk.payload.style?.textProperties.fontSize);
            return `<tspan style="${textStyleToString(chunk.payload.style?.textProperties)}" font-size="${fontSize}">` + chunksToText(chunk.children, ctx) + '</tspan>\n';
          }
        default:
          return chunksToText(chunk.children, ctx);
      }
      break;
  }

  return '';
}

export function chunksToText(chunks: MarkdownNode[], ctx: ToTextContext): string {
  const retVal = [];

  ctx = Object.assign({ rules: [], mode: 'md' }, ctx);

  for (let chunkNo = 0; chunkNo < chunks.length; chunkNo++) {
    const chunk = chunks[chunkNo];

    if ('tag' in chunk && ['SVG/', 'IMG/'].includes(chunk.tag)) {
      let broke = false;
      for (const rule of ctx.rules) {
        const { shouldBreak, text } = applyRewriteRule(rule, {
          ...chunk,
          mode: 'TODO', // TODO
          href: 'payload' in chunk ? chunk.payload?.href : undefined,
          alt: 'payload' in chunk ? chunk.payload?.alt : undefined
        });

        if (shouldBreak) {
          retVal.push(text);
          broke = true;
          break;
        }
      }

      if (broke) {
        return retVal.join('');;
      }
    }

    if ('tag' in chunk && 'A' === chunk.tag) {
      // let matchingNo = -1;
      //
      // for (let idx = chunkNo + 1; idx < chunks.length; idx++) {
      //   const chunkEnd = chunks[idx];
      //   if ('tag' in chunkEnd && chunkEnd.tag === '/A') {
      //     matchingNo = idx;
      //     break;
      //   }
      // }

      // if (matchingNo !== -1) {
        const alt = chunksToText(chunk.children, { ...ctx, onlyNotTag: true }); // .filter(i => !i.isTag)
        let broke = false;
        for (const rule of ctx.rules) {
          const { shouldBreak, text } = applyRewriteRule(rule, {
            ...chunk,
            mode: 'TODO', // TODO
            href: 'payload' in chunk ? chunk.payload?.href : undefined,
            alt
          });

          if (shouldBreak) {
            retVal.push(text);
            broke = true;
            break;
          }
        }

        // if (broke) {
        //   chunks.splice(chunkNo, matchingNo - chunkNo);
        //   return retVal;
        // }
      // }
    }

    retVal.push(chunkToText(chunk, ctx));
  }

  // chunks.map(c => chunkToText(c));
  /*
  */

  return retVal.join('');
}

export async function walkRecursiveAsync(node: MarkdownNode, callback: (node: MarkdownNode, ctx?: object) => Promise<object | void>, ctx?: object) {
  if (node.isTag) {
    const subCtx = await callback(node, ctx) || Object.assign({}, ctx);
    for (let nodeIdx = 0; nodeIdx < node.children.length; nodeIdx++) {
      const child = node.children[nodeIdx];
      const retVal = await walkRecursiveAsync(child, callback, { ...subCtx, nodeIdx });
      if (retVal && 'nodeIdx' in retVal && typeof retVal.nodeIdx === 'number') {
        nodeIdx = retVal.nodeIdx;
      }
    }
    return subCtx;
  } else {
    return await callback(node, ctx);
  }
}

export function walkRecursiveSync(node: MarkdownNode, callback: (node: MarkdownNode, ctx?: object) => object | void, ctx?: object, callbackEnd?: (node: MarkdownNode, ctx?: object) => object | void): void | object {
  if (node.isTag) {
    const subCtx = callback(node, ctx) || Object.assign({}, ctx);
    // let nodeIdx = 0;
    for (let nodeIdx = 0; nodeIdx < node.children.length; nodeIdx++) {
      const child = node.children[nodeIdx];
      const retVal = walkRecursiveSync(child, callback, { ...subCtx, nodeIdx }, callbackEnd);
      if (retVal && 'nodeIdx' in retVal && typeof retVal.nodeIdx === 'number') {
        nodeIdx = retVal.nodeIdx;
      }
    }
    if (callbackEnd) {
      callbackEnd(node, ctx);
    }
    return subCtx;
  } else {
    return callback(node, ctx);
  }
}

export async function extractText(node: MarkdownNode) {
  let retVal = '';
  await walkRecursiveAsync(node, async (child) => {
    if (child.isTag === false) {
      retVal += child.text;
      return;
    }
    if (child.isTag === true) {
      if (['BR/', 'EOL/', 'EMPTY_LINE/'].includes(child.tag)) {

      }
      return;
    }

  });
  return retVal;
}

/*
export function extractText(node: MarkdownTagNode, start: number, end: number, rules: RewriteRule[] = []) {
  const slice = chunksToText(node.children.slice(start, end).filter(i => !i.isTag || ['BR/', 'EOL/', 'EMPTY_LINE/'].includes(i.tag)), rules);
  return slice;
}
*/


export function dump(body: MarkdownTagNode, logger = console) {
  let position = 0;

  walkRecursiveSync(body, (chunk, ctx: { level: number }) => {
    let line = position + '\t';

    switch (chunk.mode) {
      case 'md':
        line += 'M ';
        break;
      case 'html':
        line += 'H ';
        break;
      case 'raw':
        line += 'R ';
        break;
    }

    line += spaces(ctx.level);

    if (chunk.isTag === true) {
      line += chunk.tag;

      if (chunk.tag === 'UL') {
        line += ` (Level: ${chunk.payload.listLevel})`;
      }
      if (chunk.tag === 'LI') {
        line += ` (${chunk.payload?.bullet || chunk.payload?.number}, Level: ${chunk.payload.listLevel})`;
      }

    }
    if (chunk.isTag === false) {
      line += chunk.text
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '[TAB]');
    }

    if (chunk.comment) {
      line += '\t// ' + chunk.comment;
    }

    if (logger === console) {
      // if (line.indexOf('StateMachine.ts:') > -1) {
      //   console.log(ansi_colors.gray(line));
      //   continue;
      // }
      console.log(line);
      // continue;
    } else {
      logger.log(line);
    }

    position++;

    return { ...ctx, level: ctx.level + 1 };
  }, { level: 0 });
}
