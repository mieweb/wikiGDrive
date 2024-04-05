import {MarkdownNodes} from '../MarkdownNodes.js';
import {walkRecursiveSync} from '../markdownNodesUtils.js';

export function removeEmptyTags(markdownChunks: MarkdownNodes) {
  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'P'].includes(chunk.tag) && chunk.children.length === 0) {
      chunk.parent.children.splice(ctx.nodeIdx, 1);
      return {nodeIdx: ctx.nodeIdx - 1};
    }

  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
