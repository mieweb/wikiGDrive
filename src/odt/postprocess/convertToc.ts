import {walkRecursiveSync} from '../markdownNodesUtils.js';
import {MarkdownNodes} from '../MarkdownNodes.js';

export function convertToc(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (!(chunk.isTag && chunk.tag === 'TOC')) {
      return;
    }

    for (let idx = 0; idx < chunk.children.length; idx++) {
      const child = chunk.children[idx];
      if (child.isTag && child.tag === 'P') {
        const liElement = markdownChunks.createNode('LI');
        const children = chunk.children.splice(idx, 1, liElement);
        liElement.children.splice(0, 0, ...children);
      }
    }

    const ulElement = markdownChunks.createNode('UL');
    const children = chunk.children.splice(0, chunk.children.length, ulElement);
    ulElement.children.splice(0, 0, ...children);
  });
}
