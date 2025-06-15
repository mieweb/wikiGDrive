import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests:
// test content.xml transform to object
// test ./issue-431
// test ./issue-432
// test ./issue-434
// test ./issue-434-2
// test ./issue-435-436
// test ./issue-443
// test ./our-docs
// test ./header-link
// test ./nested-ordered-list.md
// test ./bullets.md
// test ./quotes.md
// test ./curly-braces.md
// test ./confluence.md
// test ./project-overview.md
// test ./intro-to-the-system.md
// test ./list-test.md
// test ./lettered-list.md
// test ./list-indent.md
// test ./strong-headers.md
// test ./embedded-diagram-example.md
// test ./suggest.md
// test ./raw-html.md
// test ./pre-mie.md
// test ./block-macro.md
// test ./example-document.md
// test ./line-breaks.md
// test ./code-links.md
// test ./code-blocks.md
// test ./rewrite-rules.md.markdown
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

      if (chunk.children.length > 0) {
        const lastChild = chunk.children[chunk.children.length - 1];
        if (lastChild.isTag && lastChild.tag === 'BR/') {
          chunk.children.splice(chunk.children.length - 1, 1);
        }
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
