import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function mergeTexts(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.parent && chunk.isTag === false && chunk.mode === 'md') {
      const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];
      // console.log('HIT', ctx.nodeIdx);
      if (nextChunk?.isTag === false && nextChunk?.mode === 'md') {
        chunk.text = chunk.text + nextChunk.text;
        chunk.parent.children.splice(ctx.nodeIdx + 1, 1);


        return {nodeIdx: ctx.nodeIdx - 1};
      }
    }
  });
}
