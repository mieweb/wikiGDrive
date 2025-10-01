import {MarkdownNodes} from '../MarkdownNodes.ts';
import {extractText, walkRecursiveAsync} from '../markdownNodesUtils.ts';

// Related tests:
// test ./issue-443
// test ./intro-to-the-system.md
// test ./list-test.md
// test ./list-indent.md
// test ./strong-headers.md
// test ./example-document.md
// test ./fix-bold.md
export async function fixBoldItalic(markdownChunks: MarkdownNodes) {
  // Remove empty Bold and empty Italic
  await walkRecursiveAsync(markdownChunks.body, async (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag === true && ['B', 'I'].includes(chunk.tag)) {
      if (chunk.children.length === 0) {
        chunk.parent.children.splice(ctx.nodeIdx, 1);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }

      if (chunk.children.length === 1) {
        const insideChunk = chunk.children[0];
        if (chunk.isTag === true && insideChunk.isTag && chunk.tag === insideChunk.tag) {
          chunk.children.splice(0, 1, insideChunk);
          return { nodeIdx: ctx.nodeIdx - 1 };
        }
      }
    }

    if (chunk.isTag === true && ['B'].includes(chunk.tag)) {
      if (chunk.parent?.isTag && ['H1', 'H2', 'H3', 'H4', 'BI'].includes(chunk.parent.tag)) {
        const chunkChildren = chunk.children.splice(0, chunk.children.length);
        chunk.parent.children.splice(ctx.nodeIdx, 1, ...chunkChildren);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }
    }

    if (chunk.isTag === true && ['I'].includes(chunk.tag)) {
      const innerTxt = extractText(chunk);
      if (innerTxt.startsWith('{{%') && innerTxt.endsWith('%}}')) {
        chunk.parent?.children.splice(ctx.nodeIdx, 1, ...chunk.children);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }
    }
  });
}
