import {ListStyle, Style} from './LibreOffice.ts';
import {fixCharacters} from './utils.ts';
import {RewriteRule} from './applyRewriteRule.ts';
import {chunksToText} from './markdownNodesUtils.ts';

export type OutputMode = 'md' | 'html' | 'raw';

export type TAG = 'BODY' | 'HR/' | 'B' | 'I' | 'BI' | 'BLANK/' | // | '/B' | '/I' | '/BI'
  'BR/' | // BR/ is intentional line break (2 spaces at the end of line) - shift+enter
  'EOL/' | // EOL/ is line ending
  'EMPTY_LINE/' | // EMPTY_LINE/ is blank line (it can be merged or removed)
  'H1' | 'H2' | 'H3' | 'H4' | //'/H1' | '/H2' | '/H3' | '/H4' |
  'P' | 'CODE' | 'PRE' | // '/P' | '/CODE' | '/PRE' |
  'UL' | 'LI' | 'A' | // | '/UL' | '/LI' | '/A'
  'TABLE' | 'TR' | 'TD' | // | '/TABLE' | '/TR' | '/TD'
  'TOC' | 'SVG/' | 'IMG/' | // | '/TOC'
  'EMB_SVG' | 'EMB_SVG_G' | 'EMB_SVG_P/' | 'EMB_SVG_TEXT' | // | '/EMB_SVG' | '/EMB_SVG_G' | '/EMB_SVG_TEXT'
  'EMB_SVG_TSPAN' | // | '/EMB_SVG_TSPAN'
  'CHANGE_START' | 'CHANGE_END' | 'HTML_MODE/' | 'MD_MODE/' | 'COMMENT';

export const isSelfClosing = (tag: TAG) => tag.endsWith('/');
// export const isOpening = (tag: TAG) => !tag.startsWith('/') && !tag.endsWith('/');
// export const isClosing = (tag: TAG) => tag.startsWith('/');

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

export interface MarkdownTextNode {
  isTag: false;
  text: string;
  comment?: string;
  parent?: MarkdownTagNode;
}

export interface MarkdownTagNode {
  isTag: true;
  tag: TAG;
  payload: TagPayload;
  comment?: string;
  children: MarkdownNode[];
  parent?: MarkdownTagNode;
}

export type MarkdownNode = MarkdownTextNode | MarkdownTagNode;

// eslint-disable-next-line @typescript-eslint/no-unused-vars


export class MarkdownNodes {
  // chunks: MarkdownNode[] = [];

  public readonly body: MarkdownTagNode;

  constructor() {
    this.body = this.createNode('BODY', {});
  }

  createNode(tag: TAG, payload: TagPayload = {}): MarkdownTagNode {
    const node: MarkdownTagNode = {
      isTag: true,
      tag,
      payload,
      children: []
    };

    const oldSplice = node.children.splice;
    node.children.splice = function (start, deleteCount, ...items) {
      const retVal = oldSplice.apply(node.children, [start, deleteCount, ...items]);
      // const retVal = oldSplice(start, deleteCount, ...items);

      for (let idx = 0; idx < items.length; idx++) {
        items[idx].parent = node;
      }

      return retVal;
    };

    return node;
  }

  // get length() {
  //   return this.chunks.length;
  // }

  // push(s: MarkdownChunk) {
  //   this.chunks.push(s);
  // }

  toString(rules: RewriteRule[] = []) {
    // console.log(this.chunks.map(c => debugChunkToText(c)).join('\n'));
    return chunksToText(this.body.children, { rules, mode: 'md', addLiIndents: true })
      .split('\n')
      .map(line => line.trim().length > 0 ? line : '')
      .join('\n');
  }

  replace(start: number, end: number, chunk: MarkdownNode) {
    const deleteCount = end - start + 1;
    this.body.children.splice(start, deleteCount, chunk);
    for (let i = start; i < this.body.children.length; i++) {
      const chunk = this.body.children[i];
      if (chunk.isTag) {
        chunk.payload.position -= deleteCount;
      }
    }
  }

  removeChunk(start: number, deleteCount = 1, comment = '') {
    throw new Error('TODO remove');
    this.body.children.splice(start, deleteCount);
    /*, {
      mode: 'raw',
      isTag: true,
      tag: 'BLANK/',
      payload: {},
      children: []
      comment
    }
    */
    for (let i = start; i < this.body.children.length; i++) {
      const chunk = this.body.children[i];
      if (chunk.isTag) {
        chunk.payload.position -= deleteCount;
      }
    }
  }

  // findNext(tag: TAG, start: number) {
  //   let nextTagPosition = -1;
  //   for (let idx = start + 1; idx < this.chunks.length; idx++) {
  //     const chunk = this.chunks[idx];
  //     if (chunk.isTag && chunk.mode === 'md' && chunk.tag === tag) {
  //       nextTagPosition = idx;
  //       break;
  //     }
  //   }
  //   return nextTagPosition;
  // }
  append(parent: MarkdownTagNode, child: MarkdownTagNode) {
    parent.children.push(child);
    child.parent = parent;
  }

  appendText(parent: MarkdownTagNode, txt: string) {
    txt = fixCharacters(txt);
    parent.children.push({
      isTag: false,
      text: txt,
      parent,
      comment: 'MarkdownNodes.ts: appendText'
    });
  }
}
