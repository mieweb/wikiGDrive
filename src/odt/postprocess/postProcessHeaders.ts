import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function postProcessHeaders(markdownChunks: MarkdownNodes) {

  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4'].indexOf(chunk.tag) > -1) {
      if (chunk.children.length === 0) {
        chunk.parent.children.splice(ctx.nodeIdx, 1);
      }
      return;
    }

    if (chunk.isTag && chunk.tag === 'P') {
      if (chunk.children.length === 1) {
        const preChunk = chunk.children[0];

        if (preChunk.isTag && preChunk.tag === 'PRE') {
          preChunk.parent = chunk.parent;
          chunk.parent.children.splice(ctx.nodeIdx, 1, preChunk);
        }
      }
      return;
    }

  });
}
