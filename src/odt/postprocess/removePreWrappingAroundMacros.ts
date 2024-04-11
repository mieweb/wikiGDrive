import {MarkdownNodes} from '../MarkdownNodes.ts';
import {isMarkdownBeginMacro, isMarkdownEndMacro} from '../macroUtils.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function removePreWrappingAroundMacros(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (preChunk, ctx: { nodeIdx: number }) => {
    if (preChunk.isTag === true && preChunk.tag === 'PRE') {
      if (preChunk.children.length > 0) {
        let lastChildIdx = -1;
        for (let idx = preChunk.children.length - 1; idx >= 0; idx--) {
          const child = preChunk.children[idx];
          if (child && child.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(child.tag)) {
            continue;
          }
          lastChildIdx = idx;
          break;
        }

        const lastChild = preChunk.children[lastChildIdx];
        if (lastChild && lastChild.isTag === false && isMarkdownEndMacro(lastChild.text)) {
          lastChild.parent = preChunk.parent;
          const after = preChunk.children.splice(lastChildIdx, preChunk.children.length - lastChildIdx);
          preChunk.parent.children.splice(ctx.nodeIdx + 1, 0, ...after);
        }
      }

      if (preChunk.children.length > 0) {
        let firstChildIdx = 0;
        const firstChild = preChunk.children[firstChildIdx];
        if (firstChild && firstChild.isTag === false && isMarkdownBeginMacro(firstChild.text)) {
          const afterFirst = preChunk.children[firstChildIdx + 1];
          if (afterFirst && afterFirst.isTag && afterFirst.tag === 'EOL/') {
            firstChildIdx++;
          }

          const before = preChunk.children.splice(0, firstChildIdx + 1);
          preChunk.parent.children.splice(ctx.nodeIdx, 0, ...before);
        }
      }
    }
  });
}
