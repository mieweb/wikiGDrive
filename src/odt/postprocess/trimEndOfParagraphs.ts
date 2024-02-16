import {MarkdownChunks} from '../MarkdownChunks.js';

export function trimEndOfParagraphs(markdownChunks: MarkdownChunks) {
  for (let position = 1; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (chunk.isTag === true && chunk.tag === '/P') {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag === false) {
        prevChunk.text = prevChunk.text.replace(/ +$/, '');
      }
    }
  }
}
