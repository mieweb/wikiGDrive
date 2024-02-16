import slugify from 'slugify';

import {isClosing, isOpening, MarkdownChunks, OutputMode, TAG, TagPayload} from './MarkdownChunks.ts';
import {fixCharacters} from './utils.ts';
import {RewriteRule} from './applyRewriteRule.ts';
import {postProcessHeaders} from './postprocess/postProcessHeaders.js';
import {postProcessPreMacros} from './postprocess/postProcessPreMacros.js';
import {addIndentsAndBullets} from './postprocess/addIndentsAndBullets.js';
import {fixBold} from './postprocess/fixBold.js';
import {hideSuggestedChanges} from './postprocess/hideSuggestedChanges.js';
import {addEmptyLines} from './postprocess/addEmptyLines.js';
import {mergeParagraphs} from './postprocess/mergeParagraphs.js';
import {removePreWrappingAroundMacros} from './postprocess/removePreWrappingAroundMacros.js';
import {fixListParagraphs} from './postprocess/fixListParagraphs.js';
import {fixSpacesInsideInlineFormatting} from './postprocess/fixSpacesInsideInlineFormatting.js';
import {removeInsideDoubleCodeBegin} from './postprocess/removeInsideDoubleCodeBegin.js';

interface TagLeaf {
  mode: OutputMode;
  level: number;
  tag: TAG;
  payload: TagPayload;
}

export function isMarkdownBeginMacro(innerTxt: string) {
  if ('{{markdown}}' === innerTxt) return true;
  if ('{{% markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

export function isMarkdownEndMacro(innerTxt: string) {
  if ('{{/markdown}}' === innerTxt) return true;
  if ('{{% /markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

export function isMarkdownMacro(innerTxt) {
  const prefix = innerTxt.substring(0, innerTxt.indexOf('}}') + '}}'.length);
  const suffix = innerTxt.substring(innerTxt.lastIndexOf('{{'));
  return isMarkdownBeginMacro(prefix) && isMarkdownEndMacro(suffix);
}

export function stripMarkdownMacro(innerTxt) {
  const prefix = innerTxt.substring(0, innerTxt.indexOf('}}') + '}}'.length);
  const suffix = innerTxt.substring(innerTxt.lastIndexOf('{{'));
  if (isMarkdownBeginMacro(prefix) && isMarkdownEndMacro(suffix)) {
    return innerTxt.substring(prefix.length, innerTxt.length - suffix.length);
  }
  return innerTxt;
}

export class StateMachine {
  public errors: string[] = [];
  private readonly tagsTree: TagLeaf[] = [];
  private listLevel = 0;
  private rewriteRules: RewriteRule[] = [];

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

      if (payload.continueNumbering || payload.continueList) {
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
        payload.number = payload.number || this.fetchListNo(listStyleName);
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
      payload,
      comment: 'pushTag'
    });

    // POST-PUSH-BEFORE-TREEPOP

// Quarantine.
// TODO: Remove after 2024.10.03
// Related: code-links.md
//     if (tag === '/CODE') {
//       switch (this.currentMode) {
//         case 'md':
//           if (this.parentLevel?.tag === 'P' || !this.parentLevel) {
//             const matchingPos = this.currentLevel.payload.position; // this.parentLevel.payload.position + 1
//             const afterPara = this.markdownChunks.chunks[matchingPos];
//             if (afterPara.isTag === true && afterPara.tag === 'CODE') {
//               afterPara.tag = 'PRE';
//               this.markdownChunks.chunks[this.markdownChunks.length - 1] = {
//                 isTag: true,
//                 mode: this.currentMode,
//                 tag: '/PRE',
//                 payload
//               };
//             }
//           }
//       }
//     }

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

    // Inside list item tags like <strong> needs to be html tags
    if (this.currentMode === 'md' && tag === '/P' && this.parentLevel?.tag === 'LI') {
      for (let pos = this.currentLevel.payload.position + 1; pos < payload.position; pos++) {
        const chunk = this.markdownChunks.chunks[pos];
        if (chunk.isTag && chunk.tag === 'A') continue;
        if (chunk.isTag && chunk.tag === '/A') continue;
        if (chunk.isTag && chunk.tag === 'IMG/') continue;
        if (chunk.isTag && chunk.tag === 'SVG/') continue;

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
          payload: {},
          comment: 'Merging PRE tags'
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
      this.markdownChunks.chunks[payload.position] = {
        isTag: true,
        mode: this.currentMode,
        tag: 'BR/',
        payload: {}
      };
    }
    if (tag === '/TD') {
      const prevChunk = this.markdownChunks.chunks[payload.position - 1];
      if (prevChunk.isTag && prevChunk.tag === 'BR/') {
        this.markdownChunks.removeChunk(payload.position - 1);
      }
    }

    if (tag === '/I') {
      const innerTxt = this.markdownChunks.extractText(this.currentLevel.payload.position, payload.position, this.rewriteRules);
      if (innerTxt.startsWith('{{%') && innerTxt.endsWith('%}}')) {
        this.markdownChunks.removeChunk(payload.position);
        this.markdownChunks.removeChunk(this.currentLevel.payload.position);
      }
    }

    if (tag === 'HTML_MODE/') {
      this.currentMode = 'html';
    }
    if (tag === 'MD_MODE/') {
      this.currentMode = 'md';
    }

    if (tag === '/P' || tag === '/PRE') {
      const innerTxt = this.markdownChunks.extractText(this.currentLevel.payload.position, payload.position, this.rewriteRules);
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

    if (tag === '/CODE') {
      const innerTxt = this.markdownChunks.extractText(this.currentLevel.payload.position, payload.position, this.rewriteRules);
      switch (this.currentMode) {
        case 'md':
          if (isMarkdownMacro(innerTxt)) {
            this.markdownChunks.replace(this.currentLevel.payload.position, payload.position, {
              isTag: false,
              mode: this.currentMode,
              text: stripMarkdownMacro(innerTxt)
            });
          }
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
      text: txt,
      comment: 'pushText'
    });
  }

  postProcess() {
    postProcessHeaders(this.markdownChunks);
    removePreWrappingAroundMacros(this.markdownChunks);
    removeInsideDoubleCodeBegin(this.markdownChunks);
    fixSpacesInsideInlineFormatting(this.markdownChunks);
    fixBold(this.markdownChunks);
    fixListParagraphs(this.markdownChunks);
    hideSuggestedChanges(this.markdownChunks);
    addEmptyLines(this.markdownChunks);
    addIndentsAndBullets(this.markdownChunks);
    postProcessPreMacros(this.markdownChunks);
    mergeParagraphs(this.markdownChunks, this.rewriteRules);

    if (process.env.DEBUG_COLORS) {
      this.markdownChunks.dump();
    }
  }

  pushError(error: string) {
    this.errors.push(error);
  }

  setRewriteRules(rewriteRules: RewriteRule[]) {
    this.rewriteRules = rewriteRules;
  }
}
