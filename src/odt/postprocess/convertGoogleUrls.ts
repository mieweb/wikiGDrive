import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';
import {replaceUrlsWithIds} from '../../utils/idParsers.ts';

// Related tests:
// test ./our-docs
export function convertGoogleUrls(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if ('text' in chunk) {
      chunk.text = replaceUrlsWithIds(chunk.text);
    }
  });
}
