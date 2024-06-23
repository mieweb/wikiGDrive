import {walkRecursiveAsync} from '../markdownNodesUtils.ts';
import {MarkdownNodes} from '../MarkdownNodes.ts';

export async function rewriteHeaders(markdownChunks: MarkdownNodes) {
  await walkRecursiveAsync(markdownChunks.body, async (chunk) => {
    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) {
      if (chunk.children.length > 1) {
        const first = chunk.children[0];
        if (first.isTag && first.tag === 'BOOKMARK/') {
          const toMove = chunk.children.splice(0, 1);
          chunk.children.splice(chunk.children.length, 0, ...toMove);
        }
      }
    }
  });
}
