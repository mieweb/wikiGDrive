import {ListStyle, Style} from './LibreOffice.ts';
import {fixCharacters} from './utils.ts';
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
  'MATHML' |
  'CHANGE_START' | 'CHANGE_END' | 'RAW_MODE/' | 'HTML_MODE/' | 'MD_MODE/' | 'MACRO_MODE/' | 'COMMENT' | 'BOOKMARK/';

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
  numFormat?: string;
  number?: number;
  style?: Style;
  styleTxt?: string;
  listStyle?: ListStyle;
  continueNumbering?: boolean;
  listLevel?: number;
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

export class MarkdownNodes {
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

  toString() {
    return chunksToText(this.body.children, { mode: 'md', addLiIndents: true })
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
