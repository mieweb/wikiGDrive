import {MarkdownChunks} from '../MarkdownChunks.js';

export function postProcessHeaders(markdownChunks: MarkdownChunks) {
  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (chunk.isTag && ['/H1', '/H2', '/H3', '/H4'].indexOf(chunk.tag) > -1) {
      const prevChunk = markdownChunks.chunks[position - 1];
      const tagOpening = chunk.tag.substring(1);
      if (prevChunk.isTag && prevChunk.tag === tagOpening) {
        markdownChunks.removeChunk(position);
        markdownChunks.removeChunk(position - 1);
        position -= 2;
        continue;
      }
    }


    if (chunk.isTag && chunk.tag === 'PRE') {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag && prevChunk.tag === 'P') {
        markdownChunks.removeChunk(position - 1);
        position--;
        continue;
      }
    }

    if (chunk.isTag && chunk.tag === '/PRE') {
      const prevChunk = markdownChunks.chunks[position + 1];
      if (prevChunk?.isTag && prevChunk.tag === '/P') {
        markdownChunks.removeChunk(position + 1);
        position--;
        continue;
      }
    }
  }
}
