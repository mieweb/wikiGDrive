import {MarkdownNodes} from '../MarkdownNodes.ts';
import {extractText, walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests:
// test ./issue-431
// test ./list-test.md
// test ./suggest.md
// test ./raw-html.md
// test ./pre-mie.md
// test ./block-macro.md
// test ./example-document.md
// test ./code-blocks.md
export function mergeParagraphs(markdownChunks: MarkdownNodes) {

  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && ['P', 'PRE'].includes(chunk.tag)) {
      if (chunk.tag === 'PRE' && chunk.payload?.lang === 'math') {
        return;
      }
      if (chunk.tag === 'PRE' && chunk.payload?.lang === 'codeblockend') {
        chunk.payload.lang = '';
        return;
      }

      const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];
      if (nextChunk?.isTag && nextChunk.tag === chunk.tag) {
        const children = nextChunk.children.splice(0, nextChunk.children.length);

        if (chunk.tag === 'P') {
          const temp = markdownChunks.createNode('P');
          temp.children.splice(0, 0, ...children);
          const innerTxt = extractText(temp);
          if (!innerTxt.startsWith('{{/rawhtml}}')) {
            const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
            emptyLine.comment = 'mergeParagraphs.ts: empty line between two of: ' + chunk.tag;
            children.unshift(emptyLine);
          }
        }

        if (chunk.tag === 'PRE' && nextChunk.payload?.lang) {
          chunk.payload.lang = nextChunk.payload?.lang;
        }

        chunk.children.splice(chunk.children.length, 0, ...children);

        chunk.parent.children.splice(ctx.nodeIdx + 1, 1);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
