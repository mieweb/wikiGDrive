import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function trimParagraphs(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.isTag === true && ['P', 'H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) {
      while (chunk.children.length > 0) {
        const lastChunk = chunk.children[chunk.children.length - 1];
        if (lastChunk.isTag === false) {
          let origText = lastChunk.text;
          lastChunk.text = lastChunk.text.replace(/\s+$/, '');

          if (lastChunk.text === '') {
            chunk.children.splice(chunk.children.length - 1, 1);
            continue;
          }

          if (origText === lastChunk.text) {
            break;
          }
          continue;
        }
        break;
      }

      while (chunk.children.length > 0) {
        const firstChunk = chunk.children[0];
        if (firstChunk.isTag === false) {
          const origText = firstChunk.text;
          firstChunk.text = firstChunk.text.replace(/^\s+/, '');

          if (firstChunk.text === '') {
            chunk.children.splice(0, 1);
            continue;
          }

          if (origText === firstChunk.text) {
            break;
          }
          continue;
        }
        break;
      }
    }
  });
}
