import {MarkdownChunks, OutputMode} from './MarkdownChunks';
import {fixCharacters, spaces} from './utils';
import {Style} from './LibreOffice';

type TAG = 'HR/' | 'B' | '/B' | 'I' | '/I' | 'BI' | '/BI' |
  'H1' | 'H2' | 'H3' | 'H4' | '/H1' | '/H2' | '/H3' | '/H4' |
  'P' | '/P' | 'CODE' | '/CODE' | 'PRE' | '/PRE' |
  'UL' | '/UL' | 'LI' | '/LI' | 'A' | '/A' |
  'TABLE' | '/TABLE' | 'TR' | '/TR' | 'TD' | '/TD' |
  'TOC' | '/TOC' | 'SVG/' | 'IMG/';

interface StackPos {
  mode: 'md' | 'html';
  counterId?: string;
}

const DEFAULT_STACK_POS: StackPos = {
  mode: 'md',
  counterId: ''
};

interface TagPayload {
  id?: string;
  counterId?: string;
  href?: string;
  alt?: string;
  marginLeft?: number;
  number?: number;
  style?: Style;
}

type Handler = (payload: TagPayload, stateMachine: StateMachine) => Promise<void>;

const HTML_HANDLERS: {[name: string]: Handler} = {
  'CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<code>', mode: stateMachine.currentMode });
  },
  '/CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</code>`', mode: stateMachine.currentMode });
  },
  'UL': async (payload: TagPayload, stateMachine: StateMachine) => {
    // if (payload.numbered) {
    //   stateMachine.markdownChunks.push({ txt: '<ol>', mode: stateMachine.currentMode });
    // } else {
      stateMachine.markdownChunks.push({ txt: '<ul>', mode: stateMachine.currentMode });
    // }
  },
  '/UL': async (payload: TagPayload, stateMachine: StateMachine) => {
    // if (payload.numbered) {
    //   stateMachine.markdownChunks.push({ txt: '</ol>', mode: stateMachine.currentMode });
    // } else {
      stateMachine.markdownChunks.push({txt: '</ul>', mode: stateMachine.currentMode});
    // }
  },
  'LI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<li>', mode: stateMachine.currentMode });
  },
  '/LI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</li>', mode: stateMachine.currentMode });
  },
  'BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<strong><em>', mode: stateMachine.currentMode });
  },
  '/BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</em></strong>', mode: stateMachine.currentMode });
  },
  'B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<strong>', mode: stateMachine.currentMode });
  },
  '/B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</strong>', mode: stateMachine.currentMode });
  },
  'I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<em>', mode: stateMachine.currentMode });
  },
  '/I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</em>', mode: stateMachine.currentMode });
  },
  'P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<p>', mode: stateMachine.currentMode });
  },
  '/P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</p>\n', mode: stateMachine.currentMode });
  },
  'H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h1>', mode: stateMachine.currentMode });
  },
  'H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h2>', mode: stateMachine.currentMode });
  },
  'H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h3>', mode: stateMachine.currentMode });
  },
  'H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<h4>', mode: stateMachine.currentMode });
  },
  '/H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h1>', mode: stateMachine.currentMode });
  },
  '/H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h2>', mode: stateMachine.currentMode });
  },
  '/H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h3>', mode: stateMachine.currentMode });
  },
  '/H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</h4>', mode: stateMachine.currentMode });
  },
  'HR': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '<hr />', mode: stateMachine.currentMode });
  },
  'A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: `<a href="${payload.href}">`, mode: stateMachine.currentMode });
  },
  '/A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '</a>', mode: stateMachine.currentMode });
  }
};

const MD_HANDLERS: {[name: string]: Handler} = {
  'CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '`', mode: stateMachine.currentMode });
  },
  '/CODE': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '`', mode: stateMachine.currentMode });
  },
  'I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_', mode: stateMachine.currentMode });
  },
  '/I': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_', mode: stateMachine.currentMode });
  },
  'BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**_', mode: stateMachine.currentMode });
  },
  '/BI': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '_**', mode: stateMachine.currentMode });
  },
  'B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**', mode: stateMachine.currentMode });
  },
  '/B': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '**', mode: stateMachine.currentMode });
  },
  'P': async (payload: TagPayload, stateMachine: StateMachine) => {
    if (payload.marginLeft) {
      stateMachine.markdownChunks.push({ txt: spaces(payload.marginLeft), mode: stateMachine.currentMode });
    }
    if (stateMachine.parentLevel?.tag === 'TOC') {
      stateMachine.markdownChunks.push({ txt: '* ', mode: stateMachine.currentMode });
    }
    if (stateMachine.parentLevel?.tag === 'LI') {
      if ([ 'WWNum2', 'WWNum3' ].indexOf(payload.style?.listStyleName) > -1) {
        stateMachine.markdownChunks.push({ txt: `${stateMachine.parentLevel.payload.number}. `, mode: stateMachine.currentMode });
      } else {
        stateMachine.markdownChunks.push({ txt: '* ', mode: stateMachine.currentMode });
      }
    }
  },
  '/P': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '\n', mode: stateMachine.currentMode });
  },
  'H1': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '# ', mode: stateMachine.currentMode });
  },
  'H2': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '## ', mode: stateMachine.currentMode });
  },
  'H3': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '### ', mode: stateMachine.currentMode });
  },
  'H4': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '#### ', mode: stateMachine.currentMode });
  },
  'HR': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '\n___\n ', mode: stateMachine.currentMode });
  },
  'A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: '[', mode: stateMachine.currentMode });
  },
  '/A': async (payload: TagPayload, stateMachine: StateMachine) => {
    stateMachine.markdownChunks.push({ txt: `](${payload.href})`, mode: stateMachine.currentMode });
  }
};

interface TagLeaf {
  level: number;
  tag: TAG;
  payload: TagPayload;
}

const isOpening = (tag: TAG) => !tag.startsWith('/') && !tag.endsWith('/');
const isClosing = (tag: TAG) => tag.startsWith('/');

export class StateMachine {
  private globalListCounters = {};

  private stack: StackPos[] = [];
  private top: StackPos = DEFAULT_STACK_POS;
  private readonly tagsTree: TagLeaf[] = [];

  currentMode: OutputMode = 'md';
  private handlers = {
    html: HTML_HANDLERS,
    md: MD_HANDLERS,
  };

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
    if (tag === 'UL') {
      payload.number = 1;
    }
    if (tag === 'LI') {
      if (this.currentLevel?.tag === 'UL') {
        payload.number = this.currentLevel.payload.number;
      }
    }

    if (isOpening(tag)) {
      this.tagsTree.push({
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
  }

  pushText(txt: string) {
    txt = fixCharacters(txt);
    this.markdownChunks.push({ txt: txt, mode: this.currentMode });
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
