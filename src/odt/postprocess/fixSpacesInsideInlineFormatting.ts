import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests:
// test ./issue-434
// test ./example-document.md
export function fixSpacesInsideInlineFormatting(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (!chunk.parent) {
      return;
    }

    if (chunk.isTag && ['B', 'I'].indexOf(chunk.tag) > -1) {
      const prevChunk = chunk.children[chunk.children.length - 1];
      if (prevChunk && prevChunk.isTag === false) {
        const text = prevChunk.text;
        const removedTrailingSpaces = text.replace(/[\s]+$/, '');
        const spaces = text.substring(removedTrailingSpaces.length);
        if (spaces.length > 0) {
          prevChunk.text = removedTrailingSpaces;
          chunk.parent.children.splice(ctx.nodeIdx + 1, 0, {
            isTag: false,
            text: spaces,
            comment: 'fixSpacesInsideInlineFormatting.ts: spaces.length > 0'
          });
          // position++;
        }
      }
    }
  });
}
