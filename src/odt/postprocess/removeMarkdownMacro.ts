import {MarkdownNodes} from '../MarkdownNodes.ts';
import {extractText, walkRecursiveAsync} from '../markdownNodesUtils.ts';
import {isMarkdownMacro, stripMarkdownMacro} from '../macroUtils.ts';

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
      const innerTxt = extractText(chunk);
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
