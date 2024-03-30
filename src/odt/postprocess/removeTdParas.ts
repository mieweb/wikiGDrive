import {MarkdownNodes} from '../MarkdownNodes.js';
import {walkRecursiveSync} from '../markdownNodesUtils.js';

export function removeTdParas(markdownChunks: MarkdownNodes) {
  let inHtml = false;

  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { level: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml && chunk.isTag && ['TD', 'LI'].includes(chunk.tag)) {
      for (let pos = 0; pos < chunk.children.length; pos++) {
        const child = chunk.children[pos];
        if (child.isTag && child.tag === 'P') {
          chunk.children.splice(pos, 1, ...child.children);
        }
      }

      while (chunk.children.length > 0) {
        const lastChild = chunk.children[chunk.children.length - 1];
        if (lastChild.isTag && lastChild.tag === 'EOL/') {
          chunk.children.splice(chunk.children.length - 1, 1);
          continue;
        }
        break;
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
