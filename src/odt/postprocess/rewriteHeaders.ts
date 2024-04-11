import slugify from 'slugify';
import {extractText, walkRecursiveAsync, walkRecursiveSync} from '../markdownNodesUtils.ts';
import {MarkdownNodes} from '../MarkdownNodes.ts';

export async function rewriteHeaders(markdownChunks: MarkdownNodes) {
  const headersMap = {};

  await walkRecursiveAsync(markdownChunks.body, async (chunk) => {
    if (chunk.isTag === true && ['H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) { // && 'md' === this.currentMode) {
      if (chunk.payload.bookmarkName) {
        const innerTxt = extractText(chunk);
        const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true, remove: /[#*+~.()'"!:@]/g });
        if (slug) {
          headersMap['#' + chunk.payload.bookmarkName] = '#' + slug;
        }
      }
    }
  });

  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.isTag === true && chunk.payload?.href) {
      if (headersMap[chunk.payload.href]) {
        chunk.payload.href = headersMap[chunk.payload.href];
      }
    }
  });
}
