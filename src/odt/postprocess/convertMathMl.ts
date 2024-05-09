import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function convertMathMl(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (!(chunk.isTag && chunk.tag === 'MATHML')) {
      return;
    }

    const prevChunk = chunk.parent.children[ctx.nodeIdx - 1];
    const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];

    if (prevChunk?.isTag === false || nextChunk?.isTag === false) {
      const text = chunk.children.filter(c => c.isTag === false).map(c => c['text']).join('\n');
      chunk.parent.children.splice(ctx.nodeIdx, 1, {
        isTag: false,
        text: '$$' + text + '$$'
      });
      return;
    }

    chunk.tag = 'PRE';
    chunk.payload.lang = 'math';
    const brNode = markdownChunks.createNode('EMPTY_LINE/');
    chunk.parent.children.splice(ctx.nodeIdx + 1, 0, brNode);
  });
}
