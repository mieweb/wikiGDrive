import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function trimEndOfParagraphs(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.isTag === true && chunk.tag === 'P') {
      if (chunk.children.length > 0) {
        const lastChunk = chunk.children[chunk.children.length - 1];
        if (lastChunk.isTag === false) {
          lastChunk.text = lastChunk.text.replace(/ +$/, '');
        }
      }
    }
  });
}
