import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function removeInsideDoubleCodeBegin(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (preChunk) => {
    if (preChunk.isTag === true && preChunk.tag === 'PRE') {
      if (preChunk.children.length > 0) {

        const firstChild = preChunk.children[0];
        if (firstChild.isTag === false && firstChild.text.startsWith('```') && firstChild.text.length > 3) {
            preChunk.payload.lang = firstChild.text.substring(3);
            preChunk.children.splice(0, 1);
        }
      }
    }
  });
}
