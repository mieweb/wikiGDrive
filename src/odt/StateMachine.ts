import {isClosing, isOpening, MarkdownChunks, OutputMode, TAG, TagPayload} from './MarkdownChunks';
import {fixCharacters} from './utils';
import slugify from 'slugify';

interface TagLeaf {
  mode: OutputMode;
  level: number;
  tag: TAG;
  payload: TagPayload;
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
            case '{{/markdown}}':
            case '{{% /markdown %}}':
              this.currentMode = 'md';
              break;
          }
        }
        break;
        case 'md':
        {
          if (this.currentLevel.payload.bookmarkName) {
            const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true });
            if (slug) {
              this.headersMap[this.currentLevel.payload.bookmarkName] = slug;
            }
          }

          switch (innerTxt) {
            case '{{rawhtml}}':
              this.currentMode = 'raw';
              break;
            case '{{markdown}}':
            case '{{% markdown %}}':
              this.currentMode = 'raw';
              break;
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
        const preChunk = this.markdownChunks.chunks[position - 1];
        const tag2 = chunk.tag.substring(1);
        if (preChunk.isTag && preChunk.tag === tag2) {
          this.markdownChunks.removeChunk(position - 1);
          this.markdownChunks.removeChunk(position);
          position -= 2;
          continue;
        }
      }


      if (chunk.isTag && chunk.tag === 'PRE') {
        const preChunk = this.markdownChunks.chunks[position - 1];
        if (preChunk.isTag && preChunk.tag === 'P') {
          this.markdownChunks.removeChunk(position - 1);
          position--;
          continue;
        }
      }

      if (chunk.isTag && chunk.tag === '/PRE') {
        const preChunk = this.markdownChunks.chunks[position + 1];
        if (preChunk?.isTag && preChunk.tag === '/P') {
          this.markdownChunks.removeChunk(position + 1);
          position--;
          continue;
        }
      }
    }

    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag === false && (chunk.text === '{{% markdown %}}' || chunk.text === '{{markdown}}')) {
        const preChunk = this.markdownChunks.chunks[position - 1];
        const postChunk = this.markdownChunks.chunks[position + 1];
        if (preChunk.isTag && preChunk.tag === 'PRE' && postChunk.isTag && postChunk.tag === '/PRE') {
          this.markdownChunks.removeChunk(position - 1);
          postChunk.tag = 'PRE';
          position--;
          continue;
        }
      }

      if (chunk.isTag === false && (chunk.text === '{{% /markdown %}}' || chunk.text === '{{/markdown}}')) {
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

    const matching = {
      '/B': 'B',
      '/I': 'I',
    };

    const double = ['B', 'I', '/B', '/I'];

    for (let position = 0; position < this.markdownChunks.length; position++) {
      const chunk = this.markdownChunks.chunks[position];
      if (chunk.isTag && Object.keys(matching).indexOf(chunk.tag) > -1) {
        const preChunk = this.markdownChunks.chunks[position - 1];
        if (preChunk.isTag && preChunk.tag === matching[chunk.tag]) {
          this.markdownChunks.removeChunk(position);
          this.markdownChunks.removeChunk(position - 1);
          position-=2;
          continue;
        }
      }

      if (chunk.isTag && double.indexOf(chunk.tag) > -1) {
        const preChunk = this.markdownChunks.chunks[position - 1];
        if (preChunk.isTag && preChunk.tag == chunk.tag) {
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

  }
}
