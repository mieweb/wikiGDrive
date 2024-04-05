import {MarkdownNodes} from '../MarkdownNodes.js';
import {extractText, walkRecursiveAsync} from '../markdownNodesUtils.js';
import {isMarkdownMacro, stripMarkdownMacro} from '../macroUtils.js';

export async function removeMarkdownMacro(markdownChunks: MarkdownNodes) {
  let inHtml = false;
  await walkRecursiveAsync(markdownChunks.body, async (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && chunk.tag === 'CODE') {
      const innerTxt = await extractText(chunk);
      if (isMarkdownMacro(innerTxt)) {
        chunk.parent.children.splice(ctx.nodeIdx, 1, {
          isTag: false,
          text: stripMarkdownMacro(innerTxt),
          comment: 'stripMarkdownMacro.ts: replace code part with stripped macro'
        });
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
