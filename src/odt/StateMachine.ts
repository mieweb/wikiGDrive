import {MarkdownChunks, OutputMode} from './MarkdownChunks';
import {fixCharacters, spaces} from './utils';
import {Style, ListStyle} from './LibreOffice';
import slugify from 'slugify';

type TAG = 'HR/' | 'B' | '/B' | 'I' | '/I' | 'BI' | '/BI' |
  'H1' | 'H2' | 'H3' | 'H4' | '/H1' | '/H2' | '/H3' | '/H4' |
  'P' | '/P' | 'CODE' | '/CODE' | 'PRE' | '/PRE' |
  'UL' | '/UL' | 'LI' | '/LI' | 'A' | '/A' |
  'TABLE' | '/TABLE' | 'TR' | '/TR' | 'TD' | '/TD' |
  'TOC' | '/TOC' | 'SVG/' | 'IMG/';

interface StackPos {
  mode: 'md' | 'html' | 'raw';
  counterId?: string;
}

const DEFAULT_STACK_POS: StackPos = {
  mode: 'md',
  counterId: ''
};

interface TagPayload {
  position?: number;
  id?: string;
  counterId?: string;
  href?: string;
  alt?: string;
  marginLeft?: number;
  number?: number;
  style?: Style;
  listStyle?: ListStyle;
  listLevel?: number;
  bookmarkName?: string;
}

type Handler = (payload: TagPayload, stateMachine: StateMachine) => Promise<void>;

const HTML_HANDLERS: {[name: string]: Handler} = {
  'CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<code>', mode: stateMachine.currentMode, isTag: true });
  },
  '/CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</code>`', mode: stateMachine.currentMode, isTag: true });
  },
  'UL': async (payload: TagPayload, stateMachine: StateMachine) => {
    // if (payload.numbered) {
    //   stateMachine.markdownChunks.push({ txt: '<ol>', mode: stateMachine.currentMode, isTag: true });
    // } else {
      stateMachine.markdownChunks.push({ txt: '<ul>', mode: stateMachine.currentMode, isTag: true });
    // }
  },
  '/UL': async (payload: TagPayload, stateMachine: StateMachine) => {
    // if (payload.numbered) {
    //   stateMachine.markdownChunks.push({ txt: '</ol>', mode: stateMachine.currentMode, isTag: true });
    // } else {
      stateMachine.markdownChunks.push({ txt: '</ul>', mode: stateMachine.currentMode, isTag: true });
    // }
  },
  'LI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<li>', mode: stateMachine.currentMode, isTag: true });
  },
  '/LI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</li>', mode: stateMachine.currentMode, isTag: true });
  },
  'BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<strong><em>', mode: stateMachine.currentMode, isTag: true });
  },
  '/BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</em></strong>', mode: stateMachine.currentMode, isTag: true });
  },
  'B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<strong>', mode: stateMachine.currentMode, isTag: true });
  },
  '/B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</strong>', mode: stateMachine.currentMode, isTag: true });
  },
  'I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<em>', mode: stateMachine.currentMode, isTag: true });
  },
  '/I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</em>', mode: stateMachine.currentMode, isTag: true });
  },
  'P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<p>', mode: stateMachine.currentMode, isTag: true });
  },
  '/P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</p>\n', mode: stateMachine.currentMode, isTag: true });
  },
  'H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h1>', mode: stateMachine.currentMode, isTag: true });
  },
  'H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h2>', mode: stateMachine.currentMode, isTag: true });
  },
  'H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h3>', mode: stateMachine.currentMode, isTag: true });
  },
  'H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h4>', mode: stateMachine.currentMode, isTag: true });
  },
  '/H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h1>', mode: stateMachine.currentMode, isTag: true });
  },
  '/H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h2>', mode: stateMachine.currentMode, isTag: true });
  },
  '/H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h3>', mode: stateMachine.currentMode, isTag: true });
  },
  '/H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h4>', mode: stateMachine.currentMode, isTag: true });
  },
  'HR': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<hr />', mode: stateMachine.currentMode, isTag: true });
  },
  'A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: `<a href="${payload.href}">`, mode: stateMachine.currentMode, isTag: true });
  },
  '/A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</a>', mode: stateMachine.currentMode, isTag: true });
  }
};

const MD_HANDLERS: {[name: string]: Handler} = {
  'CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '`', mode: stateMachine.currentMode, isTag: true });
  },
  '/CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '`', mode: stateMachine.currentMode, isTag: true });
  },
  'I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_', mode: stateMachine.currentMode, isTag: true });
  },
  '/I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_', mode: stateMachine.currentMode, isTag: true });
  },
  'BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**_', mode: stateMachine.currentMode, isTag: true });
  },
  '/BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_**', mode: stateMachine.currentMode, isTag: true });
  },
  'B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**', mode: stateMachine.currentMode, isTag: true });
  },
  '/B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**', mode: stateMachine.currentMode, isTag: true });
  },
  'P': async (payload: TagPayload, stateMachine: StateMachine) => {
    if (payload.marginLeft) {
      stateMachine.markdownChunks.push({ txt: spaces(payload.marginLeft), mode: stateMachine.currentMode, isTag: true });
    }
    if (stateMachine.parentLevel?.tag === 'TOC') {
      stateMachine.markdownChunks.push({ txt: '* ', mode: stateMachine.currentMode, isTag: true });
    }
    if (stateMachine.parentLevel?.tag === 'LI') {
      const level = stateMachine.parentLevel.payload.listLevel;
      const listStyle = stateMachine.parentLevel.payload.listStyle || stateMachine.currentLevel.payload.listStyle;
      const isNumeric = !!(listStyle?.listLevelStyleNumber && listStyle.listLevelStyleNumber.find(i => i.level == level));

      if (isNumeric) {
        stateMachine.markdownChunks.push({ txt: `${stateMachine.parentLevel.payload.number}. `, mode: stateMachine.currentMode, isTag: true });
      } else {
        stateMachine.markdownChunks.push({ txt: '* ', mode: stateMachine.currentMode, isTag: true });
      }
    }
  },
  '/P': async (payload: TagPayload, stateMachine: StateMachine) => {
    // console.log('/P', payload.position, stateMachine.currentLevel.payload.position, innerTxt);
    const innerTxt = stateMachine.markdownChunks.extractText(stateMachine.currentLevel.payload.position, payload.position);

    if (stateMachine.currentLevel.payload.bookmarkName) {
      const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true });
      if (slug) {
        stateMachine.headersMap[stateMachine.currentLevel.payload.bookmarkName] = slug;
      }
    }

    if (stateMachine.parentLevel?.tag === 'LI') {
      stateMachine.currentMode = stateMachine.parentLevel.mode;
    }

    stateMachine.markdownChunks.push({ txt: '\n', mode: stateMachine.currentMode, isTag: true });
    switch (innerTxt) {
      case '{{rawhtml}}':
        stateMachine.currentMode = 'raw';
        break;
      case '{{markdown}}':
      case '{{% markdown %}}':
        stateMachine.currentMode = 'raw';
        break;
    }
  },
  'H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '# ', mode: stateMachine.currentMode, isTag: true });
  },
  'H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '## ', mode: stateMachine.currentMode, isTag: true });
  },
  'H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '### ', mode: stateMachine.currentMode, isTag: true });
  },
  'H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '#### ', mode: stateMachine.currentMode, isTag: true });
  },
  'HR': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '\n___\n ', mode: stateMachine.currentMode, isTag: true });
  },
  'A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '[', mode: stateMachine.currentMode, isTag: true });
  },
  '/A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: `](${payload.href})`, mode: stateMachine.currentMode, isTag: true });
  }
};

const RAW_HANDLERS = {
  '/P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '\n', mode: stateMachine.currentMode, isTag: true });
    const innerTxt = stateMachine.markdownChunks.extractText(stateMachine.currentLevel.payload.position, payload.position);
    switch (innerTxt) {
      case '{{/rawhtml}}':
        stateMachine.currentMode = 'md';
        break;
      case '{{/markdown}}':
      case '{{% /markdown %}}':
        stateMachine.currentMode = 'md';
        break;
    }
  },
};

interface TagLeaf {
  mode: 'md' | 'html' | 'raw';
  level: number;
  tag: TAG;
  payload: TagPayload;
}

const isOpening = (tag: TAG) => !tag.startsWith('/') && !tag.endsWith('/');
const isClosing = (tag: TAG) => tag.startsWith('/');

export class StateMachine {
  private readonly tagsTree: TagLeaf[] = [];
  private listLevel = 0;

  currentMode: OutputMode = 'md';
  private handlers = {
    html: HTML_HANDLERS,
    md: MD_HANDLERS,
    raw: RAW_HANDLERS,
  };
  headersMap: { [id: string]: string } = {};

  constructor(public markdownChunks: MarkdownChunks) {
  }

  get parentLevel() {
    if (this.tagsTree.length > 1) {
      return this.tagsTree[this.tagsTree.length - 2];
    }
  }

  get currentLevel() {
    if (this.tagsTree.length > 0) {
      return this.tagsTree[this.tagsTree.length - 1];
    }
  }

  pushTag(tag: TAG, payload: TagPayload = {}) {
    payload.position = this.markdownChunks.length;
    if (tag === 'UL') {
      this.listLevel++;
      payload.listLevel = this.listLevel;
      payload.number = 1;
    }
    if (tag === 'LI') {
      if (this.currentLevel?.tag === 'UL') {
        payload.listLevel = this.currentLevel.payload.listLevel;
        payload.number = this.currentLevel.payload.number;
      }
    }

    if (isOpening(tag)) {
      this.tagsTree.push({
        mode: this.currentMode,
        tag,
        payload,
        level: this.tagsTree.length
      });
    }

    if (this.handlers[this.currentMode][tag]) {
      this.handlers[this.currentMode][tag](payload, this);
    }

    if (isClosing(tag)) {
      this.tagsTree.pop();
    }
    if (tag === '/LI') {
      if (this.currentLevel?.tag === 'UL') {
        this.currentLevel.payload.number++;
      }
    }
    if (tag === '/UL') {
      this.listLevel--;
    }
  }

  pushText(txt: string) {
    txt = fixCharacters(txt);
    this.markdownChunks.push({ txt: txt, mode: this.currentMode, isTag: false });
  }
/*

  private recalcTop() {
    this.top = Object.assign({}, DEFAULT_STACK_POS);
    for (const item of this.stack) {
      for (const k in item) {
        this.top[k] = item[k];
      }
    }
  }
  push(item: StackPos) {
    this.stack.push(item);
    this.recalcTop();
  }

  pop() {
    return this.stack.pop();
    this.recalcTop();
  }
*/

}
