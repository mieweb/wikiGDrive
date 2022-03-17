import {isClosing, isOpening, MarkdownChunks, OutputMode, TAG, TagPayload} from './MarkdownChunks';
import {fixCharacters, spaces} from './utils';
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


    if (tag === '/P') {
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
        this.currentLevel.payload.number++;
      }
    }
    if (tag === '/UL') {
      this.listLevel--;
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
}
