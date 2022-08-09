import {isClosing, isOpening, MarkdownChunks, MarkdownTagChunk, OutputMode, TAG, TagPayload} from './MarkdownChunks';
import {fixCharacters, spaces} from './utils';
import slugify from 'slugify';

interface TagLeaf {
  mode: OutputMode;
  level: number;
  tag: TAG;
  payload: TagPayload;
}

function isMarkdownBeginMacro(innerTxt: string) {
  if ('{{markdown}}' === innerTxt) return true;
  if ('{{% markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

function isMarkdownEndMacro(innerTxt: string) {
  if ('{{/markdown}}' === innerTxt) return true;
  if ('{{% /markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

function isPreBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}');
}

function isPreEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}');
}

export class StateMachine {
  private readonly tagsTree: TagLeaf[] = [];
  private listLevel = 0;

  currentMode: OutputMode = 'md';
  headersMap: { [id: string]: string } = {};

  counters: { [id: string]: number } = {};
  private preserveMinLevel = 999;

  constructor(public markdownChunks: MarkdownChunks) {
  }

  fetchListNo(styleName: string) {
    if (this.counters[styleName]) {
      return this.counters[styleName];
    }
    return 0;
  }

  storeListNo(styleName: string, val: number) {
    if (!styleName) {
      return;
    }
    this.counters[styleName] = val;
  }

  clearListsNo(styleNamePrefix: string, minLevel) {
    for (const k in this.counters) {
      if (!k.startsWith(styleNamePrefix)) {
        continue;
      }
      const level = parseInt(k.substring(styleNamePrefix.length));
      if (level < minLevel) {
        continue;
      }
      if (level > minLevel + 1) {
        // continue;
      }
      this.counters[k] = 0;
    }
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

  getParentListStyleName(): string {
    for (let i = this.tagsTree.length - 1; i >=0; i--) {
      const leaf = this.tagsTree[i];
      if (leaf.tag === 'UL') {
        if (leaf.payload.listStyle?.name) {
          return leaf.payload.listStyle.name;
        }
      }
    }
    return null;
  }

  pushTag(tag: TAG, payload: TagPayload = {}) {
    payload.position = this.markdownChunks.length;

    if (tag === 'UL') {
      this.listLevel++;
      payload.listLevel = this.listLevel;

      if (payload.continueNumbering) {
        this.preserveMinLevel = this.listLevel;
      }

      if (!(this.preserveMinLevel <= this.listLevel)) {
        this.clearListsNo((payload.listStyle?.name || this.getParentListStyleName()) + '_', this.listLevel);
      }
    }
    if (tag === 'LI') {
      if (this.currentLevel?.tag === 'UL') {
        payload.listLevel = this.currentLevel.payload.listLevel;
        const listStyleName = (payload.listStyle?.name || this.getParentListStyleName()) + '_' + payload.listLevel;
        payload.number = this.fetchListNo(listStyleName);
        payload.number++;
        this.storeListNo(listStyleName, payload.number);
      }
    }

    // PRE-PUSH-PRE-TREEPUSH

    if (isOpening(tag)) {
      this.tagsTree.push({
        mode: this.currentMode,
        tag,
        payload,
        level: this.tagsTree.length
      });
    }

    // PRE-PUSH-AFTER-TREEPUSH

    // PUSH

    this.markdownChunks.push({
      isTag: true,
      mode: this.currentMode,
      tag: tag,
      payload
    });

    // POST-PUSH-BEFORE-TREEPOP

    if (tag === '/CODE') {
      switch (this.currentMode) {
        case 'md':
          if (this.parentLevel?.tag === 'P' || !this.parentLevel) {
            const matchingPos = this.currentLevel.payload.position; // this.parentLevel.payload.position + 1
            const afterPara = this.markdownChunks.chunks[matchingPos];
            if (afterPara.isTag === true && afterPara.tag === 'CODE') {
              afterPara.tag = 'PRE';
              this.markdownChunks.chunks[this.markdownChunks.length - 1] = {
                isTag: true,
                mode: this.currentMode,
                tag: '/PRE',
                payload
              };
            }
          }
      }
    }

    if (tag === 'P') {
      switch (this.currentMode) {
        case 'md':
          if (this.parentLevel?.tag === 'TOC') {
            payload.bullet = true;
          }
          if (this.parentLevel?.tag === 'LI') {
            const level = this.parentLevel.payload.listLevel;
            const listStyle = this.parentLevel.payload.listStyle || this.currentLevel.payload.listStyle;
            const isNumeric = !!(listStyle?.listLevelStyleNumber && listStyle.listLevelStyleNumber.find(i => i.level == level));

            payload.listLevel = level;

            if (isNumeric) {
              payload.number = this.parentLevel.payload.number;
            } else {
              payload.bullet = true;
            }
          }
          break;
      }
    }

    if (this.currentMode === 'md' && tag === '/P' && this.parentLevel?.tag === 'LI') {
      for (let pos = this.currentLevel.payload.position + 1; pos < payload.position; pos++) {
        const chunk = this.markdownChunks.chunks[pos];
        if (chunk.isTag && chunk.tag === 'A') continue;
        if (chunk.isTag && chunk.tag === '/A') continue;

        chunk.mode = 'html';
      }
    }

    if (this.currentMode === 'md' && tag === '/TABLE') {
      for (let pos = this.currentLevel.payload.position; pos < payload.position + 1; pos++) {
        const chunk = this.markdownChunks.chunks[pos];
        chunk.mode = 'html';
      }
    }


    if (tag === 'PRE') {
      const prevTag = this.markdownChunks.chunks[payload.position - 1];
      if (prevTag.isTag && prevTag.tag === '/PRE') {
        this.markdownChunks.removeChunk(payload.position - 1);
        this.markdownChunks.chunks[payload.position] = {
          isTag: true,
          mode: this.currentMode,
          tag: 'BR/',
          payload: {}
        };
      }
    }

    if (tag === 'B' && ['H1', 'H2', 'H3', 'H4', 'BI'].indexOf(this.parentLevel?.tag) > -1) {
      this.markdownChunks.removeChunk(payload.position);
    }
    if (tag === '/B' && ['H1', 'H2', 'H3', 'H4', '/BI'].indexOf(this.parentLevel?.tag) > -1) {
      this.markdownChunks.removeChunk(payload.position);
    }

    if (tag === 'P' && this.parentLevel?.tag === 'TD') {
      this.markdownChunks.removeChunk(payload.position);
    }
    if (tag === '/P' && this.parentLevel?.tag === 'TD') {
      this.markdownChunks.removeChunk(payload.position);
    }

    if (tag === '/I') {
      const innerTxt = this.markdownChunks.extractText(this.currentLevel.payload.position, payload.position);
      if (innerTxt.startsWith('{{%') && innerTxt.endsWith('%}}')) {
        this.markdownChunks.removeChunk(payload.position);
        this.markdownChunks.removeChunk(this.currentLevel.payload.position);
      }
    }

    if (tag === 'EMB_SVG') {
      this.currentMode = 'html';
    }
    if (tag === '/EMB_SVG') {
      this.currentMode = 'md';
    }

    if (tag === '/P' || tag === '/PRE') {
      const innerTxt = this.markdownChunks.extractText(this.currentLevel.payload.position, payload.position);
      switch (this.currentMode) {
        case 'raw':
        {
          switch (innerTxt) {
            case '{{/rawhtml}}':
              this.currentMode = 'md';
              break;
          }
          if (isMarkdownEndMacro(innerTxt)) {
            this.currentMode = 'md';
          }
        }
          break;
        case 'md':
        {
          if (this.currentLevel.payload.bookmarkName) {
            const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true, remove: /[#*+~.()'"!:@]/g });
            if (slug) {
              this.headersMap[this.currentLevel.payload.bookmarkName] = slug;
            }
          }

          switch (innerTxt) {
            case '{{rawhtml}}':
              this.currentMode = 'raw';
              break;
          }
          if (isMarkdownBeginMacro(innerTxt)) {
            this.currentMode = 'raw';
          }

        }
          break;
      }
    }

    if (isClosing(tag)) {
      this.tagsTree.pop();
    }

    // POST-PUSH-AFTER-TREEPOP

    if (tag === '/LI') {
      if (this.currentLevel?.tag === 'UL') {
        // this.currentLevel.payload.number++;
        // const listStyleName = (payload.listStyle?.name || this.getParentListStyleName()) + '_' + this.listLevel;
        // this.storeListNo(listStyleName, this.currentLevel.payload.number);
      }
    }
    if (tag === '/UL') {
      this.listLevel--;
      this.preserveMinLevel = 999;
    }
  }

  pushText(txt: string) {
    txt = fixCharacters(txt);
    this.markdownChunks.push({
      isTag: false,
      mode: this.currentMode,
      text: txt
    });
  }

  postProcess() {
    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];

      if (chunk.isTag && ['/H1', '/H2', '/H3', '/H4'].indexOf(chunk.tag) > -1) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        const tagOpening = chunk.tag.substring(1);
        if (prevChunk.isTag && prevChunk.tag === tagOpening) {
          this.markdownChunks.removeChunk(position);
          this.markdownChunks.removeChunk(position - 1);
          position -= 2;
          continue;
        }
      }


      if (chunk.isTag && chunk.tag === 'PRE') {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag && prevChunk.tag === 'P') {
          this.markdownChunks.removeChunk(position - 1);
          position--;
          continue;
        }
      }

      if (chunk.isTag && chunk.tag === '/PRE') {
        const prevChunk = this.markdownChunks.chunks[position + 1];
        if (prevChunk?.isTag && prevChunk.tag === '/P') {
          this.markdownChunks.removeChunk(position + 1);
          position--;
          continue;
        }
      }
    }

    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag === false && isMarkdownBeginMacro(chunk.text)) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        const postChunk = this.markdownChunks.chunks[position + 1];
        if (prevChunk.isTag && prevChunk.tag === 'PRE' && postChunk.isTag && postChunk.tag === '/PRE') {
          this.markdownChunks.removeChunk(position - 1);
          postChunk.tag = 'PRE';
          position--;
          continue;
        }
      }

      if (chunk.isTag === false && isMarkdownEndMacro(chunk.text)) {
        const preChunk = this.markdownChunks.chunks[position - 1];
        const postChunk = this.markdownChunks.chunks[position + 1];
        if (preChunk.isTag && preChunk.tag === 'PRE' && postChunk.isTag && postChunk.tag === '/PRE') {
          preChunk.tag = '/PRE';
          this.markdownChunks.removeChunk(position + 1);
          position--;
          continue;
        }
      }
    }

    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag === false && chunk.text.startsWith('```') && chunk.text.length > 3) {
        const preChunk = this.markdownChunks.chunks[position - 2];
        if (preChunk.isTag && preChunk.tag === 'PRE') {
          preChunk.payload.lang = chunk.text.substring(3);
          this.markdownChunks.removeChunk(position);
          position--;
          continue;
        }
      }
    }

    for (let position = 1; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag && ['/B', '/I'].indexOf(chunk.tag) > -1) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag === false && prevChunk.mode === 'md') {
          const text = prevChunk.text;
          const removedTrailingSpaces = text.replace(/[\s]+$/, '');
          const spaces = text.substring(removedTrailingSpaces.length);
          if (spaces.length > 0) {
            prevChunk.text = removedTrailingSpaces;
            this.markdownChunks.chunks.splice(position + 1, 0, {
              isTag: false,
              mode: 'md',
              text: spaces
            });
            position++;
          }
        }
      }
    }

    const matching = {
      '/B': 'B',
      '/I': 'I'
    };

    const double = ['B', 'I', '/B', '/I'];

    for (let position = 1; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag && Object.keys(matching).indexOf(chunk.tag) > -1) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag && prevChunk.tag === matching[chunk.tag]) {
          this.markdownChunks.removeChunk(position);
          this.markdownChunks.removeChunk(position - 1);
          position-=2;
          continue;
        }
      }

      if (chunk.isTag && ['PRE'].indexOf(chunk.tag) > -1) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag && prevChunk.tag === '/PRE') {
          prevChunk.tag = 'BR/';
          this.markdownChunks.removeChunk(position);
          position--;
          continue;
        }
      }

      if (chunk.isTag && double.indexOf(chunk.tag) > -1) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag && prevChunk.tag == chunk.tag) {
          this.markdownChunks.removeChunk(position);
          position--;
          continue;
        }
      }
    }

    let nextPara = null;
    for (let position = this.markdownChunks.length - 1; position >= 0; position--) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag && chunk.tag === 'P') {
        const origNum = chunk.payload?.number;
        if (nextPara) {
          const origNextNum = nextPara.payload?.number;
          if (nextPara.payload?.listLevel && !chunk.payload?.listLevel) {
            chunk.payload.listLevel = nextPara?.payload?.listLevel;
          }
          if (!chunk.payload?.bullet && nextPara.payload?.number === chunk.payload?.number && nextPara.payload?.listLevel === chunk.payload?.listLevel) {
            delete nextPara.payload.number;
          }
        }
        nextPara = chunk;
      }
    }

    let inChange = false;
    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag && chunk.tag === 'CHANGE') {
        inChange = true;
        this.markdownChunks.removeChunk(position);
        position--;
        continue;
      }
      if (chunk.isTag && chunk.tag === '/CHANGE') {
        inChange = false;
        this.markdownChunks.removeChunk(position);
        position--;
        continue;
      }

      if (inChange) {
        this.markdownChunks.removeChunk(position);
        position--;
      }
    }

    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];

      if (position > 1 && chunk.isTag && ['H1', 'H2', 'H3', 'H4'].indexOf(chunk.tag) > -1) {
        const prevTag = this.markdownChunks.chunks[position - 1];
        if (!(prevTag.isTag && prevTag.tag === 'BR/')) {
          this.markdownChunks.chunks.splice(position - 1, 0, {
            isTag: true,
            mode: 'md',
            tag: 'BR/',
            payload: {}
          });
          position++;
        }
        continue;
      }

      if (position + 1 < this.markdownChunks.chunks.length && chunk.isTag && ['/H1', '/H2', '/H3', '/H4'].indexOf(chunk.tag) > -1) {
        const nextTag = this.markdownChunks.chunks[position + 1];

        if (!(nextTag.isTag && nextTag.tag === 'BR/')) {
          this.markdownChunks.chunks.splice(position + 1, 0, {
            isTag: true,
            mode: 'md',
            tag: 'BR/',
            payload: {}
          });
        }
        continue;
      }
    }

    // ADD indents and bullets
    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag === true && chunk.tag === 'P' && chunk.mode === 'md') {
        const level = (chunk.payload.listLevel || 1) - 1;
        const indent = spaces(level * 4);
        const listStr = chunk.payload.bullet ? '* ' : chunk.payload.number > 0 ? `${chunk.payload.number}. ` : '';
        const firstStr = indent + listStr;
        const otherStr = indent + spaces(listStr.length);

        let prevEmptyLine = 1;
        for (let position2 = position + 1; position2 < this.markdownChunks.length; position2++) {
          const chunk2 = this.markdownChunks.chunks[position2];
          if (chunk2.isTag === true && chunk2.tag === '/P' && chunk.mode === 'md') {
            position += position2 - position - 1;
            break;
          }

          if (chunk2.isTag === true && ['BR/'].indexOf(chunk2.tag) > -1) {
            prevEmptyLine = 2;
            continue;
          }

          if (prevEmptyLine > 0) {
            this.markdownChunks.chunks.splice(position2, 0, {
              mode: 'md',
              isTag: false,
              text: prevEmptyLine === 1 ? firstStr : otherStr
            });
            prevEmptyLine = 0;
            position2++;
          }
        }
      }
    }

    for (let position = 1; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];

      if (chunk.isTag === false && chunk.mode === 'md') {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag === false && prevChunk.mode === 'md') {
          prevChunk.text = prevChunk.text + chunk.text;
          this.markdownChunks.removeChunk(position);
          position-=2;
          continue;
        }
      }

      if (chunk.isTag === false && isPreBeginMacro(chunk.text)) {
        const prevChunk = this.markdownChunks.chunks[position - 1];
        if (prevChunk.isTag && prevChunk.tag === 'PRE') {
          this.markdownChunks.chunks.splice(position + 1, 0, {
            isTag: true,
            tag: 'PRE',
            mode: 'md',
            payload: {}
          });
          this.markdownChunks.removeChunk(position - 1);
          position--;
          continue;
        }
      }

      if (chunk.isTag === false && isPreEndMacro(chunk.text)) {
        const postChunk = this.markdownChunks.chunks[position + 1];
        if (postChunk.isTag && postChunk.tag === '/PRE') {
          this.markdownChunks.removeChunk(position + 1);
          this.markdownChunks.chunks.splice(position, 0, {
            isTag: true,
            tag: '/PRE',
            mode: 'md',
            payload: {}
          });
          continue;
        }
      }
    }

    if (process.env.DEBUG_COLORS) {
      this.markdownChunks.dump();
    }
  }
}
