import {MarkdownNodes} from '../MarkdownNodes.js';
import {walkRecursiveSync} from '../markdownNodesUtils.js';

export function removeTdParas(markdownChunks: MarkdownNodes) {
  // Run after addEmptyLinesAfterParas
  let inHtml = 0;

  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml++;
      return;
    }

    if (inHtml && chunk.isTag && ['TD', 'LI'].includes(chunk.tag)) {
      for (let pos = 0; pos < chunk.children.length; pos++) {
        const child = chunk.children[pos];
        if (child.isTag && child.tag === 'P') {
          const br = markdownChunks.createNode('BR/');
          br.comment = 'removeTdParas.ts: Break after removed td paragraph';
          chunk.children.splice(pos, 1, ...child.children, br);
          pos--;
          continue;
        }
      }

      while (chunk.children.length > 0) {
        const lastChild = chunk.children[chunk.children.length - 1];
        if (lastChild.isTag && ['EOL/', 'BR/'].includes(lastChild.tag)) {
          chunk.children.splice(chunk.children.length - 1, 1);
          continue;
        }
        break;
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml--;
      return;
    }
  });
}
