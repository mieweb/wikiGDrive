import {MarkdownChunks} from '../MarkdownChunks.ts';

export function removeInsideDoubleCodeBegin(markdownChunks: MarkdownChunks) {
  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag === false && chunk.text.startsWith('```') && chunk.text.length > 3) {
      const preChunk = markdownChunks.chunks[position - 2];
      if (preChunk.isTag && preChunk.tag === 'PRE') {
        preChunk.payload.lang = chunk.text.substring(3);
        markdownChunks.removeChunk(position);
        position--;
        continue;
      }
    }
  }
}
