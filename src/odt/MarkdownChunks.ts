import {ListStyle, Style} from './LibreOffice';
import {spaces} from './utils';

export type OutputMode = 'md' | 'html' | 'raw';

export type TAG = 'HR/' | 'BR/' | 'B' | '/B' | 'I' | '/I' | 'BI' | '/BI' |
  'H1' | 'H2' | 'H3' | 'H4' | '/H1' | '/H2' | '/H3' | '/H4' |
  'P' | '/P' | 'CODE' | '/CODE' | 'PRE' | '/PRE' |
  'UL' | '/UL' | 'LI' | '/LI' | 'A' | '/A' |
  'TABLE' | '/TABLE' | 'TR' | '/TR' | 'TD' | '/TD' |
  'TOC' | '/TOC' | 'SVG/' | 'IMG/';

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
  listLevel?: number;
  bookmarkName?: string;
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

function chunkToText(chunk: MarkdownChunk) {
  if (chunk.isTag === false) {
    return chunk.text;
  }

  switch (chunk.mode) {
    case 'raw':
      switch (chunk.tag) {
        case '/P':
          return '\n';
        case 'BR/':
          return '\n';
      }
      break;
    case 'md':
      switch (chunk.tag) {
        case 'P':
          {
            const indent = spaces(chunk.payload.marginLeft || 0);
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
          return '<svg src="${chunk.payload.href}" />';
        case 'IMG/':
          return `<img src="${chunk.payload.href}" />`;
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
