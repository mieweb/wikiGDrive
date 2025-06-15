import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests
// test ./list-test.md
// test ./pre-mie.md
// test ./block-macro.md
export function mergeTexts(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.parent && chunk.isTag === false) {
      const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];
      if (nextChunk?.isTag === false) {
        chunk.text = chunk.text + nextChunk.text;
        chunk.parent.children.splice(ctx.nodeIdx + 1, 1);

        return {nodeIdx: ctx.nodeIdx - 1};
      }
    }
  });
}
