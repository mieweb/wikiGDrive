import {ListStyle, Style} from './LibreOffice';
import {inchesToPixels, spaces} from './utils';

export type OutputMode = 'md' | 'html' | 'raw';

export type TAG = 'HR/' | 'BR/' | 'B' | '/B' | 'I' | '/I' | 'BI' | '/BI' |
  'H1' | 'H2' | 'H3' | 'H4' | '/H1' | '/H2' | '/H3' | '/H4' |
  'P' | '/P' | 'CODE' | '/CODE' | 'PRE' | '/PRE' |
  'UL' | '/UL' | 'LI' | '/LI' | 'A' | '/A' |
  'TABLE' | '/TABLE' | 'TR' | '/TR' | 'TD' | '/TD' |
  'TOC' | '/TOC' | 'SVG/' | 'IMG/' | 'EMB_SVG' | '/EMB_SVG' | 'EMB_SVG_G' | '/EMB_SVG_G' | 'EMB_SVG_P/' | 'EMB_SVG_TEXT' | '/EMB_SVG_TEXT';

export const isOpening = (tag: TAG) => !tag.startsWith('/') && !tag.endsWith('/');
export const isClosing = (tag: TAG) => tag.startsWith('/');

export interface TagPayload {
  lang?: string;
  position?: number;
  id?: string;
  counterId?: string;
  href?: string;
  alt?: string;
  marginLeft?: number;
  bullet?: boolean;
  number?: number;
  style?: Style;
  listStyle?: ListStyle;
  continueNumbering?: boolean;
  listLevel?: number;
  bookmarkName?: string;
  pathD?: string;

  x?: string;
  y?: string;
  width?: string;
  height?: string;
}

export interface MarkdownTextChunk {
  isTag: false;
  mode: OutputMode;
  text: string;
}

export interface MarkdownTagChunk {
  isTag: true;
  mode: OutputMode;
  tag?: TAG;
  payload: TagPayload;
}

type MarkdownChunk = MarkdownTextChunk | MarkdownTagChunk;

function debugChunkToText(chunk: MarkdownChunk) {
  if (chunk.isTag === false) {
    return chunk.text;
  }

  return chunk.tag;
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
          {
            const level = (chunk.payload.listLevel || 1) - 1;
            const indent = spaces(level * 4);
            const listStr = chunk.payload.bullet ? '* ' : chunk.payload.number > 0 ? `${chunk.payload.number}. ` : '';
            return indent + listStr + '';
          }
          break;
        case '/P':
          return '\n';
        case 'BR/':
          return '\n';
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
          return '<svg width="100%" viewBox="0 0 1000 1000" fill="none" stroke="none" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">\n';
      }
      break;
    case 'html':
      switch (chunk.tag) {
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
          return '<svg width="100%" viewBox="0 0 1000 1000" src="${chunk.payload.href}" />';
        case 'IMG/':
          return `<img src="${chunk.payload.href}" />`;
        case 'EMB_SVG':
          return '<svg>\n';
        case '/EMB_SVG':
          return '</svg>';
        case 'EMB_SVG_G':
          {
            if (chunk.payload.x && chunk.payload.y) {
              const transformStr = `transform="translate(${inchesToPixels(chunk.payload.x)}, ${inchesToPixels(chunk.payload.y)})"`;
              return `<g ${transformStr}>\n`;
            }
            return '<g>\n';
          }
        case '/EMB_SVG_G':
          return '</g>\n';
        case 'EMB_SVG_P/':
          return `<path fill="none" stroke="black" d="${chunk.payload.pathD}" />\n`;
        case 'EMB_SVG_TEXT':
          return '<text fill="black" x="0" dy="1em" font-size="1em">';
        case '/EMB_SVG_TEXT':
          return '</text>\n';
      }
      break;
  }

}

export class MarkdownChunks {
  chunks: MarkdownChunk[] = [];

  get length() {
    return this.chunks.length;
  }

  push(s: MarkdownChunk) {
    this.chunks.push(s);
  }

  toString() {
    // console.log(this.chunks.map(c => debugChunkToText(c)).join('\n'));
    return this.chunks.map(c => chunkToText(c)).join('');
  }

  extractText(start: number, end: number) {
    const slice = this.chunks.slice(start, end).filter(i => !i.isTag).map(c => chunkToText(c)).join('');
    return slice;
  }

  removeChunk(startPara: number) {
    this.chunks.splice(startPara, 1);
    for (let i = startPara; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (chunk.isTag) {
        chunk.payload.position--;
      }
    }
  }
}
