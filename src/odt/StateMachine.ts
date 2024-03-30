import {MarkdownNodes, OutputMode, TAG, TagPayload} from './MarkdownNodes.ts';
import {RewriteRule} from './applyRewriteRule.ts';
import {isMarkdownBeginMacro, isMarkdownEndMacro} from './macroUtils.ts';
import {extractText} from './markdownNodesUtils.js';

interface TagLeaf {
  mode: OutputMode;
  level: number;
  tag: TAG;
  payload: TagPayload;
}

export class StateMachine {
  private readonly tagsTree: TagLeaf[] = [];
  private rewriteRules: RewriteRule[] = [];

  currentMode: OutputMode = 'md';

  constructor(public markdownChunks: MarkdownNodes) {
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

  async pushTag(tag: TAG, payload: TagPayload = {}) {
    payload.position = this.markdownChunks.length;

    // PRE-PUSH-PRE-TREEPUSH

    // if (isOpening(tag)) {
    //   this.tagsTree.push({
    //     mode: this.currentMode,
    //     tag,
    //     payload,
    //     level: this.tagsTree.length
    //   });
    // }
    //
    // // PRE-PUSH-AFTER-TREEPUSH
    //
    // // PUSH
    //
    // this.markdownChunks.push({
    //   isTag: true,
    //   mode: this.currentMode,
    //   tag: tag,
    //   payload,
    //   comment: 'StateMachine.ts: pushTag'
    // });

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

    // REFACT
    // if (this.currentMode === 'md' && tag === '/TABLE') {
    //   for (let pos = this.currentLevel.payload.position; pos < payload.position + 1; pos++) {
    //     const chunk = this.markdownChunks.chunks[pos];
    //     chunk.mode = 'html';
    //   }
    // }
    // /REFACT

    // REFACT
    // if (tag === 'PRE') {
    //   const prevTag = this.markdownChunks.chunks[payload.position - 1];
    //   if (prevTag.isTag && prevTag.tag === '/PRE') {
    //     this.markdownChunks.removeChunk(payload.position - 1);
    //     this.markdownChunks.chunks[payload.position] = {
    //       isTag: true,
    //       mode: this.currentMode,
    //       tag: 'BR/',
    //       payload: {},
    //       comment: 'StateMachine.ts: Merging PRE tags'
    //     };
    //   }
    // }
    // /REFACT

    // REFACT
    // if (tag === 'B' && ['H1', 'H2', 'H3', 'H4', 'BI'].indexOf(this.parentLevel?.tag) > -1) {
    //   this.markdownChunks.removeChunk(payload.position);
    // }
    // if (tag === '/B' && ['H1', 'H2', 'H3', 'H4', '/BI'].indexOf(this.parentLevel?.tag) > -1) {
    //   this.markdownChunks.removeChunk(payload.position);
    // }
    // /REFACT

    // REFACT
    // if (tag === 'P' && this.parentLevel?.tag === 'TD') {
    //   this.markdownChunks.removeChunk(payload.position);
    // }
    // if (tag === '/P' && this.parentLevel?.tag === 'TD') {
    //   this.markdownChunks.chunks[payload.position] = {
    //     isTag: true,
    //     mode: this.currentMode,
    //     tag: 'BR/',
    //     payload: {}
    //   };
    // }
    // if (tag === '/TD') {
    //   const prevChunk = this.markdownChunks.chunks[payload.position - 1];
    //   if (prevChunk.isTag && prevChunk.tag === 'BR/') {
    //     this.markdownChunks.removeChunk(payload.position - 1);
    //   }
    // }
    // /REFACT

    // REFACT
    // if (tag === '/I') {
    //   const innerTxt = extractText(this.markdownChunks.body, this.currentLevel.payload.position, payload.position, this.rewriteRules);
    //   if (innerTxt.startsWith('{{%') && innerTxt.endsWith('%}}')) {
    //     this.markdownChunks.removeChunk(payload.position);
    //     this.markdownChunks.removeChunk(this.currentLevel.payload.position);
    //   }
    // }
    // /REFACT

    // if (tag === 'HTML_MODE/') {
    //   this.currentMode = 'html';
    // }
    // if (tag === 'MD_MODE/') {
    //   this.currentMode = 'md';
    // }

    // REFACT
    // if (['/H1', '/H2', '/H3', '/H4'].includes(tag) && 'md' === this.currentMode) {
    //   if (this.currentLevel.payload.bookmarkName) {
    //     const innerTxt = extractText(this.markdownChunks.body, this.currentLevel.payload.position, payload.position, this.rewriteRules);
    //     const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true, remove: /[#*+~.()'"!:@]/g });
    //     if (slug) {
    //       this.headersMap[this.currentLevel.payload.bookmarkName] = slug;
    //     }
    //   }
    // }
    // /REFACT

    if (tag === '/P' || tag === '/PRE') {
      const innerTxt = await extractText(this.markdownChunks.body, this.currentLevel.payload.position, payload.position, this.rewriteRules);
      switch (this.currentMode) {
        case 'raw':
        {
          if (innerTxt === '{{/rawhtml}}' || isMarkdownEndMacro(innerTxt)) {
            // this.markdownChunks[payload.position].comment = 'Switching to md - isMarkdownEndMacro';
            this.currentMode = 'md';
          }
        }
          break;
        case 'md':
        {
          if (innerTxt === '{{rawhtml}}' || isMarkdownBeginMacro(innerTxt)) {
            // this.markdownChunks[payload.position].comment = 'Switching to raw - isMarkdownBeginMacro';
            this.currentMode = 'raw';
          }

        }
          break;
      }
    }

    // REFACT
    // if (tag === '/CODE') {
    //   const innerTxt = await extractText(this.markdownChunks.body, this.currentLevel.payload.position, payload.position, this.rewriteRules);
    //   switch (this.currentMode) {
    //     case 'md':
    //       if (isMarkdownMacro(innerTxt)) {
    //         this.markdownChunks.replace(this.currentLevel.payload.position, payload.position, {
    //           isTag: false,
    //           mode: this.currentMode,
    //           text: stripMarkdownMacro(innerTxt),
    //           comment: 'StateMachine.ts: replace code part with stripped macro'
    //         });
    //       }
    //   }
    // }
    // /REFACT

    // if (isClosing(tag)) {
    //   this.tagsTree.pop();
    // }

    // POST-PUSH-AFTER-TREEPOP
  }
}
