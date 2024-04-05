import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function addEmptyLinesAfterParas(markdownChunks: MarkdownNodes) {

  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (!chunk.isTag) {
      return;
    }

    if (chunk.isTag === true && ['P', 'PRE'].includes(chunk.tag)) {
      const prevChunk = chunk.children[chunk.children.length - 1] || null;
      const nextChunk = chunk.parent.children[ctx.nodeIdx + 1] || null;

      // if (chunk.children.length > 0) {
      //
      // }

      if (nextChunk && nextChunk.isTag && nextChunk.tag === 'EMPTY_LINE/') {
        // continue;
      }

      if (prevChunk && prevChunk.isTag && prevChunk.tag === 'EMPTY_LINE/') {
        // return;
      }

      chunk.children.splice(chunk.children.length, 0, {
        ...markdownChunks.createNode('EOL/'),
        comment: 'addEmptyLinesAfterParas.ts: break after ' + chunk.tag,
      });
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
