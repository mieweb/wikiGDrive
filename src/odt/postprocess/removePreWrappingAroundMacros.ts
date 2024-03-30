import {MarkdownNodes} from '../MarkdownNodes.ts';
import {isMarkdownBeginMacro, isMarkdownEndMacro} from '../macroUtils.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function removePreWrappingAroundMacros(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (preChunk, ctx: { nodeIdx: number }) => {
    if (preChunk.isTag === true && preChunk.tag === 'PRE') {
      if (preChunk.children.length > 0) {
        const lastChild = preChunk.children[preChunk.children.length - 1];
        if (lastChild.isTag === false && isMarkdownEndMacro(lastChild.text)) {
          lastChild.parent = preChunk.parent;
          preChunk.children.splice(preChunk.children.length - 1, 1);
          preChunk.parent.children.splice(ctx.nodeIdx + 1, 0, lastChild);
        }
      }

      if (preChunk.children.length > 0) {
        const firstChild = preChunk.children[0];
        if (firstChild.isTag === false && isMarkdownBeginMacro(firstChild.text)) {
          firstChild.parent = preChunk.parent;
          preChunk.children.splice(0, 1);
          preChunk.parent.children.splice(ctx.nodeIdx, 0, firstChild);
        }
      }
    }
  });
}
