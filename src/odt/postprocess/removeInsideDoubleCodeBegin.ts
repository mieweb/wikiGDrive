import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

// Related tests:
// test ./example-document.md
export function removeInsideDoubleCodeBegin(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (preChunk) => {
    if (preChunk.isTag === true && preChunk.tag === 'PRE') {
      if (preChunk.children.length > 0) {
        let firstChildIdx = -1;
        for (let idx = 0; idx < preChunk.children.length; idx++) {
          const child = preChunk.children[idx];
          if (child.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(child.tag)) {
            continue;
          }
          firstChildIdx = idx;
          break;
        }

        let lastChildIdx = -1;
        for (let idx = preChunk.children.length - 1; idx >= 0; idx--) {
          const child = preChunk.children[idx];
          if (child.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(child.tag)) {
            continue;
          }
          lastChildIdx = idx;
          break;
        }

        if (firstChildIdx === -1 || lastChildIdx === -1) {
          return;
        }

        const firstChild = preChunk.children[firstChildIdx];
        const lastChild = preChunk.children[lastChildIdx];

        if (lastChild.isTag === false && lastChild.text === '```') {
          preChunk.children.splice(lastChildIdx, preChunk.children.length - lastChildIdx);
        }

        if (firstChild.isTag === false && firstChild.text.startsWith('```') && firstChild.text.length >= 3) {
          preChunk.payload.lang = firstChild.text.substring(3);
          preChunk.children.splice(0, firstChildIdx + 1);
        }
      }
    }
  });
}
