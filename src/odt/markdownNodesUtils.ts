import {Style, TextProperty} from './LibreOffice.ts';
import {inchesToPixels, spaces} from './utils.ts';
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

function buildImageTag(payload: TagPayload) {
  const src = payload.href || '';
  const alt = payload.alt || '';
  const width = payload.width;
  const height = payload.height;
  
  let style = '';
  if (width && typeof width === 'string') {
    style += `width:${width};`;
  }
  if (height && typeof height === 'string') {
    style += ` height:${height};`;
  }
  
  if (style) {
    return `<img src="${src}" alt="${alt}" style="${style.trim()}" />`;
  }
  
  return `<img src="${src}" alt="${alt}" />`;
}

interface ToTextContext {
  mode: OutputMode;
  onlyNotTag?: boolean;
  inListItem?: boolean;
  addLiIndents?: boolean;
  isMacro?: boolean;
  parentLevel?: number;
}

function romanize(num: number): string {
  const lookup: [string, number][] = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1]
  ];

  let roman = '';
  for (const [symbol, value] of lookup) {
    while (num >= value) {
      roman += symbol;
      num -= value;
    }
  }
  return roman;
}

function addLiNumbers(chunk: MarkdownTagNode, ctx: {addLiIndents?: boolean, parentLevel?: number}, innerText: string) {
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
  }

  const level = !ctx.parentLevel ? (chunk.payload.listLevel || 1) - 1 : 0;

  const indent = spaces(level * 4);
  const listStr = ((payload) => {
    if (payload.bullet) {
      return '* ';
    }
    if (payload.number && payload.number > 0) {
      if (['a'].includes(payload.numFormat || '')) {
        return String.fromCharCode('a'.charCodeAt(0) + payload.number - 1) + '.  ';
      }
      if (['A'].includes(payload.numFormat || '')) {
        return String.fromCharCode('A'.charCodeAt(0) + payload.number - 1) + '.  ';
      }
      if (['1'].includes(payload.numFormat || '')) {
        return `${chunk.payload.number}. `;
      }
      if (['I'].includes(payload.numFormat || '')) {
        return `${romanize(payload.number)}. `;
      }
      if (['i'].includes(payload.numFormat || '')) {
        return `${romanize(payload.number).toLowerCase()}. `;
      }
    }
    return '';
  })(chunk.payload);

  const firstStr = indent + listStr;
  const otherStr = indent + spaces(4);

  return innerText
    .split('\n')
    .map((line, idx, lines) => {
      if (idx === lines.length - 1 && line === '') { // Last line should be EOL, don't put spaces after it
        return line;
      }
      if (noPara) {
        return otherStr + '' + line;
      }
      if (idx === 0) {
        return firstStr + '' + line;
      }
      return otherStr + '' + line;
    })
    .join('\n');
}

function chunkToText(chunk: MarkdownNode, ctx: ToTextContext) {
  ctx = Object.assign({ mode: 'md' }, ctx);

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
          return chunksToText(chunk.children, ctx);
        case 'PRE':
          return chunksToText(chunk.children, ctx);
        case 'BR/':
          return '\n';
        case 'EOL/':
          return '\n';
        case 'EMPTY_LINE/':
          return '\n';
        case 'BLANK/':
          return '';
      }
      return chunksToText(chunk.children, ctx);
    case 'md':
      switch (chunk.tag) {
        case 'BODY':
          return chunksToText(chunk.children, ctx);
        case 'P':
          return chunksToText(chunk.children, ctx);
        case 'BR/':
          if (ctx.isMacro) {
            return '\n';
          }
          return '  \n';
        case 'EOL/':
          return '\n';
        case 'EMPTY_LINE/':
          return '\n';
        case 'PRE':
          return '```'+ (chunk.payload?.lang || '') +'\n' + chunksToText(chunk.children, ctx) + '```\n';
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
          // if (chunk.children.length === 0) { // TODO
          //   return '\n';
          // }
          return '## ' + chunksToText(chunk.children, ctx) + '\n';
        case 'H3':
          return '### ' + chunksToText(chunk.children, ctx) + '\n';
        case 'H4':
          return '#### ' + chunksToText(chunk.children, ctx) + '\n';
        case 'HR/':
          return '___';
        case 'A':
          return '[' + chunksToText(chunk.children, ctx) + `](${chunk.payload.href})`;
        case 'SVG/':
          if (chunk.payload.width || chunk.payload.height) {
            return buildImageTag(chunk.payload);
          }
          return `![](${chunk.payload.href})`;
        case 'IMG/':
          if (chunk.payload.width || chunk.payload.height) {
            return buildImageTag(chunk.payload);
          }
          return `![](${chunk.payload.href})`;
        case 'EMB_SVG':
          return buildSvgStart(chunk.payload);
        case 'HTML_MODE/': // TODO
          return chunksToText(chunk.children, { ...ctx, mode: 'html' });
        case 'RAW_MODE/':
          return chunksToText(chunk.children, { ...ctx, mode: 'raw' });
        case 'MACRO_MODE/':
          return chunksToText(chunk.children, { ...ctx, mode: 'md', isMacro: true });
        case 'LI': // TODO
          return addLiNumbers(chunk, ctx, chunksToText(chunk.children, { ...ctx, inListItem: true, parentLevel: chunk.payload.listLevel }));
        case 'TOC':
          return chunksToText(chunk.children, ctx); // TODO
        case 'BOOKMARK/':
          return `<a id="${chunk.payload.id}"></a>`;
      }
      return chunksToText(chunk.children, ctx);
    case 'html':
      switch (chunk.tag) {
        case 'BODY':
          return chunksToText(chunk.children, ctx);
        case 'BR/':
          return '<br />\n';
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
          return '<table>\n' + chunksToText(chunk.children, ctx) + '</table>\n';
        case 'TR':
          return '<tr>\n' + chunksToText(chunk.children, ctx) + '</tr>\n';
        case 'TD':
          return '<td>' + chunksToText(chunk.children, ctx) + '</td>\n';
        case 'TOC':
          return chunksToText(chunk.children, ctx);
        case 'SVG/':
          if (chunk.payload.width || chunk.payload.height) {
            return buildImageTag(chunk.payload);
          }
          return `<object type="image/svg+xml" data="${chunk.payload.href}" ></object>`;
        case 'IMG/':
          if (chunk.payload.width || chunk.payload.height) {
            return buildImageTag(chunk.payload);
          }
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
        case 'BOOKMARK/':
          return `<a id="${chunk.payload.id}"></a>`;
      }
      return chunksToText(chunk.children, ctx);
    default:
      return '';
  }
}

export function chunksToText(chunks: MarkdownNode[], ctx: ToTextContext): string {
  const retVal = [];
  ctx = Object.assign({ mode: 'md' }, ctx);

  for (let chunkNo = 0; chunkNo < chunks.length; chunkNo++) {
    const chunk = chunks[chunkNo];
    retVal.push(chunkToText(chunk, ctx));
  }

  return retVal.join('');
}

export async function walkRecursiveAsync(node: MarkdownNode, callback: (node: MarkdownNode, ctx?: object) => Promise<object | void>, ctx?: object, callbackEnd?: (node: MarkdownNode, ctx?: object) => object | void) {
  if (node.isTag) {
    const subCtx = await callback(node, ctx) || Object.assign({}, ctx);
    for (let nodeIdx = 0; nodeIdx < node.children.length; nodeIdx++) {
      const child = node.children[nodeIdx];
      const retVal = await walkRecursiveAsync(child, callback, { ...subCtx, nodeIdx }, callbackEnd);
      if (retVal && 'nodeIdx' in retVal && typeof retVal.nodeIdx === 'number') {
        nodeIdx = retVal.nodeIdx;
      }
    }
    if (callbackEnd) {
      callbackEnd(node, ctx);
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

export function extractText(node: MarkdownNode) {
  let retVal = '';
  walkRecursiveSync(node, (child) => {
    if (child.isTag === false) {
      retVal += child.text;
      return;
    }
    if (child.isTag === true) {
      if (['BR/', 'EOL/', 'EMPTY_LINE/'].includes(child.tag)) {
        retVal += '\n';
      }
      return;
    }
  });
  return retVal;
}

export function dump(body: MarkdownTagNode, logger = console) {
  let position = 0;

  const stack = [];

  walkRecursiveSync(body, (chunk, ctx: { level: number }) => {
    let line = position + '\t';

    if (chunk.isTag && ['HTML_MODE/', 'RAW_MODE/'].includes(chunk.tag)) {
      stack.push(chunk.tag);
    }

    const mode = stack[stack.length - 1] || 'MARK_DOWN/';

    switch (mode) {
      case 'MARK_DOWN/':
        line += 'M ';
        break;
      case 'HTML_MODE/':
        line += 'H ';
        break;
      case 'RAW_MODE/':
        line += 'R ';
        break;
    }

    line += spaces(ctx.level);

    if (chunk.isTag === true) {
      line += chunk.tag;

      if (chunk.tag === 'PRE') {
        line += ` (Lang: ${chunk.payload.lang || ''})`;
      }
      if (chunk.tag === 'UL') {
        line += ` (Level: ${chunk.payload.listLevel}, #${chunk.payload?.number || ''})`;
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
  }, { level: 0 }, (chunk) => {
    if (chunk.isTag && ['HTML_MODE/', 'RAW_MODE/'].includes(chunk.tag)) {
      stack.pop();
    }
  });
}
