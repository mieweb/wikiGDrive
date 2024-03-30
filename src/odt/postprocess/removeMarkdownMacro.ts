import {MarkdownNodes} from '../MarkdownNodes.js';
import {extractText, walkRecursiveAsync} from '../markdownNodesUtils.js';
import {isMarkdownMacro, stripMarkdownMacro} from '../macroUtils.js';

export async function removeMarkdownMacro(markdownChunks: MarkdownNodes) {
  await walkRecursiveAsync(markdownChunks.body, async (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'CODE' && chunk.mode === 'md') {
      const innerTxt = await extractText(chunk);
      if (isMarkdownMacro(innerTxt)) {
        chunk.parent.children.splice(ctx.nodeIdx, 1, {
          isTag: false,
          mode: chunk.mode,
          text: stripMarkdownMacro(innerTxt),
          comment: 'stripMarkdownMacro.ts: replace code part with stripped macro'
        });
      }
    }
  });
}
