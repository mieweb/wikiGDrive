import {ListStyle, Style, TextProperty} from './LibreOffice.ts';
import {inchesToPixels} from './utils.ts';
import {applyRewriteRule, RewriteRule} from './applyRewriteRule.ts';

export type OutputMode = 'md' | 'html' | 'raw';

export type TAG = 'HR/' | 'BR/' | 'B' | '/B' | 'I' | '/I' | 'BI' | '/BI' |
  'H1' | 'H2' | 'H3' | 'H4' | '/H1' | '/H2' | '/H3' | '/H4' |
  'P' | '/P' | 'CODE' | '/CODE' | 'PRE' | '/PRE' |
  'UL' | '/UL' | 'LI' | '/LI' | 'A' | '/A' |
  'TABLE' | '/TABLE' | 'TR' | '/TR' | 'TD' | '/TD' |
  'TOC' | '/TOC' | 'SVG/' | 'IMG/' |
  'EMB_SVG' | '/EMB_SVG' | 'EMB_SVG_G' | '/EMB_SVG_G' | 'EMB_SVG_P/' | 'EMB_SVG_TEXT' | '/EMB_SVG_TEXT' |
  'EMB_SVG_TSPAN' | '/EMB_SVG_TSPAN' |
  'CHANGE' | '/CHANGE' | 'HTML_MODE/' | 'MD_MODE/';

export const isOpening = (tag: TAG) => !tag.startsWith('/') && !tag.endsWith('/');
export const isClosing = (tag: TAG) => tag.startsWith('/');

export interface TagPayload {
  lang?: string;
  position?: number;
  id?: string;
  listId?: string;
  continueList?: string;
  href?: string;
  alt?: string;
  marginLeft?: number;
  bullet?: boolean;
  number?: number;
  style?: Style;
  styleTxt?: string;
  listStyle?: ListStyle;
  continueNumbering?: boolean;
  listLevel?: number;
  bookmarkName?: string;
  pathD?: string;

  x?: number;
  y?: number;
  width?: number;
  height?: number;
  transform?: string;
}

export interface MarkdownTextChunk {
  isTag: false;
  mode: OutputMode;
  text: string;
  comment?: string;
}

export interface MarkdownTagChunk {
  isTag: true;
  mode: OutputMode;
  tag?: TAG;
  payload: TagPayload;
  comment?: string;
}

type MarkdownChunk = MarkdownTextChunk | MarkdownTagChunk;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function debugChunkToText(chunk: MarkdownChunk) {
  if (chunk.isTag === false) {
    return chunk.text;
  }

  return chunk.tag;
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

function chunkToText(chunk: MarkdownChunk) {
  if (chunk.isTag === false) {
    return chunk.text;
  }

  switch (chunk.mode) {
    case 'raw':
      switch (chunk.tag) {
        case '/P':
          return '\n';
        case '/PRE':
          return '\n';
        case 'BR/':
          return '\n';
      }
      break;
    case 'md':
      switch (chunk.tag) {
        case 'P':
          break;
        case '/P':
          return '\n';
        case 'BR/':
          return '  \n';
        case 'PRE':
          return '\n```'+ (chunk.payload?.lang || '') +'\n';
        case '/PRE':
          return '\n```\n';
        case 'CODE':
          return '`';
        case '/CODE':
          return '`';
        case 'I':
          return '*';
        case '/I':
          return '*';
        case 'BI':
          return  '**_';
        case '/BI':
          return  '_**';
        case 'B':
          return '**';
        case '/B':
          return '**';
        case 'H1':
          return '# ';
        case 'H2':
          return '## ';
        case 'H3':
          return '### ';
        case 'H4':
          return '#### ';
        case 'HR/':
          return '\n___\n ';
        case 'A':
          return '[';
        case '/A':
          return `](${chunk.payload.href})`;
        case 'SVG/':
          return `![](${chunk.payload.href})`;
        case 'IMG/':
          return `![](${chunk.payload.href})`;
        case 'EMB_SVG':
          return buildSvgStart(chunk.payload);
        case 'HTML_MODE/':
          return '\n';
      }
      break;
    case 'html':
      switch (chunk.tag) {
        case 'BR/':
          return '\n';
        case 'HR/':
          return '<hr />';
        case 'B':
          return '<strong>';
        case '/B':
          return '</strong>';
        case 'I':
          return '<em>';
        case '/I':
          return '</em>';
        case 'BI':
          return '<strong><em>';
        case '/BI':
          return '</em></strong>';
        case 'H1':
          return '<h1>';
        case 'H2':
          return '<h2>';
        case 'H3':
          return '<h3>';
        case 'H4':
          return '<h4>';
        case '/H1':
          return '</h1>';
        case '/H2':
          return '</h2>';
        case '/H3':
          return '</h3>';
        case '/H4':
          return '</h4>';
        case 'P':
          return '<p>';
        case '/P':
          return '</p>';
        case 'CODE':
          return '<code>';
        case '/CODE':
          return '</code>';
        case 'PRE':
          return '<pre>';
        case '/PRE':
          return '</pre>';
        case 'UL':
          if (chunk.payload.number > 0) {
            return '<ol>';
          } else {
            return '<ul>';
          }
        case '/UL':
          if (chunk.payload.number > 0) {
            return '</ol>';
          } else {
            return '</ul>';
          }
        case 'LI':
          return '<li>';
        case '/LI':
          return '</li>';
        case 'A':
          return `<a href="${chunk.payload.href}">`;
        case '/A':
          return '</a>';
        case 'TABLE':
          return '\n<table>\n';
        case '/TABLE':
          return '\n</table>\n';
        case 'TR':
          return '<tr>\n';
        case '/TR':
          return '</tr>\n';
        case 'TD':
          return '<td>';
        case '/TD':
          return '</td>\n';
        case 'TOC':
          break;
        case '/TOC':
          break;
        case 'SVG/':
          return `<object type="image/svg+xml" data="${chunk.payload.href}" ></object>`;
        case 'IMG/':
          return `<img src="${chunk.payload.href}" />`;
        case 'EMB_SVG':
          return buildSvgStart(chunk.payload);
        case '/EMB_SVG':
          return '</svg>\n';
        case 'EMB_SVG_G':
          {
            if (chunk.payload.x || chunk.payload.y) {
              const transformStr = `transform="translate(${chunk.payload.x || 0}, ${chunk.payload.y || 0})"`;
              return `<g ${transformStr}>\n`;
            }
            return '<g>\n';
          }
        case '/EMB_SVG_G':
          return '</g>\n';
        case 'EMB_SVG_P/':
          return `<path d="${chunk.payload.pathD}" transform="${chunk.payload.transform}" style="${styleToString(chunk.payload?.style)}" ></path>\n`;
        case 'EMB_SVG_TEXT':
          return `<text style="${chunk.payload.styleTxt || ''}" x="0" dy="100%" >`;
        case '/EMB_SVG_TEXT':
          return '</text>\n';
        case 'EMB_SVG_TSPAN':
          {
            const fontSize = inchesToPixels(chunk.payload.style?.textProperties.fontSize);
            return `<tspan style="${textStyleToString(chunk.payload.style?.textProperties)}" font-size="${fontSize}">`;
          }
        case '/EMB_SVG_TSPAN':
          return '</tspan>\n';
      }
      break;
  }

}


function chunksToText(chunks: MarkdownChunk[], rules: RewriteRule[]) {
  const retVal = [];

  for (let chunkNo = 0; chunkNo < chunks.length; chunkNo++) {
    const chunk = chunks[chunkNo];

    if ('tag' in chunk && ['SVG/', 'IMG/'].includes(chunk.tag)) {
      let broke = false;
      for (const rule of rules) {
        const { shouldBreak, text } = applyRewriteRule(rule, {
          ...chunk,
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
        continue;
      }
    }

    if ('tag' in chunk && 'A' === chunk.tag) {
      let matchingNo = -1;

      for (let idx = chunkNo + 1; idx < chunks.length; idx++) {
        const chunkEnd = chunks[idx];
        if ('tag' in chunkEnd && chunkEnd.tag === '/A') {
          matchingNo = idx;
          break;
        }
      }

      if (matchingNo !== -1) {
        const alt = chunksToText(chunks.slice(chunkNo + 1, matchingNo).filter(i => !i.isTag), rules).join('');
        let broke = false;
        for (const rule of rules) {
          const { shouldBreak, text } = applyRewriteRule(rule, {
            ...chunk,
            href: 'payload' in chunk ? chunk.payload?.href : undefined,
            alt
          });

          if (shouldBreak) {
            retVal.push(text);
            broke = true;
            break;
          }
        }

        if (broke) {
          chunks.splice(chunkNo, matchingNo - chunkNo);
          continue;
        }
      }
    }

    retVal.push(chunkToText(chunk));
  }

  // chunks.map(c => chunkToText(c));
/*
*/

  return retVal;
}


export class MarkdownChunks {
  chunks: MarkdownChunk[] = [];

  get length() {
    return this.chunks.length;
  }

  push(s: MarkdownChunk) {
    this.chunks.push(s);
  }

  toString(rules: RewriteRule[] = []) {
    // console.log(this.chunks.map(c => debugChunkToText(c)).join('\n'));
    return chunksToText(this.chunks, rules).join('')
      .split('\n')
      .map(line => line.trim().length > 0 ? line : '')
      .join('\n');
  }

  extractText(start: number, end: number, rules: RewriteRule[] = []) {
    const slice = chunksToText(this.chunks.slice(start, end).filter(i => !i.isTag), rules).join('');
    return slice;
  }

  replace(start: number, end: number, chunk: MarkdownChunk) {
    const deleteCount = end - start + 1;
    this.chunks.splice(start, deleteCount, chunk);
    for (let i = start; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (chunk.isTag) {
        chunk.payload.position -= deleteCount;
      }
    }
  }

  removeChunk(start: number, deleteCount = 1) {
    this.chunks.splice(start, deleteCount);
    for (let i = start; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (chunk.isTag) {
        chunk.payload.position -= deleteCount;
      }
    }
  }

  dump(logger = console) {
    for (let position = 0; position < this.chunks.length; position++) {
      const chunk = this.chunks[position];
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

      if (chunk.isTag === true) {
        line += chunk.tag;
      }
      if (chunk.isTag === false) {
        line += chunk.text
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '[TAB]');
      }

      if (chunk.comment) {
        line += ' // ' + chunk.comment;
      }

      logger.log(line);
    }
  }
}
