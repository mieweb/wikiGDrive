import {MarkdownNodes} from '../MarkdownNodes.ts';
import {extractText, walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests:
// test ./header-link
// test ./project-overview.md
// test ./list-indent.md
// test ./strong-headers.md
export function fixIdLinks(markdownChunks: MarkdownNodes) {
  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && 'A' === chunk.tag) {
      if (chunk.payload?.href && chunk.payload?.href.startsWith('#')) {
        const innerTxt = extractText(chunk);
        const escapedText = innerTxt.toLowerCase().replace(/[^\w]+/g, ' ').trim().replaceAll(' ', '-');
        if (escapedText) {
          chunk.payload.href = '#' + escapedText;
        }
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
