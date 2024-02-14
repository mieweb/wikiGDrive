import {MarkdownChunks} from '../MarkdownChunks.js';

export function fixBold(markdownChunks: MarkdownChunks) {

  const matching = {
    '/B': 'B',
    '/I': 'I'
  };

  const double = ['B', 'I', '/B', '/I'];

  for (let position = 1; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag && Object.keys(matching).indexOf(chunk.tag) > -1) {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag && prevChunk.tag === matching[chunk.tag]) {
        markdownChunks.removeChunk(position);
        markdownChunks.removeChunk(position - 1);
        position-=2;
        continue;
      }
    }

    if (chunk.isTag && ['PRE'].indexOf(chunk.tag) > -1) {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag && prevChunk.tag === '/PRE') {
        prevChunk.tag = 'BR/';
        markdownChunks.removeChunk(position);
        position--;
        continue;
      }
    }

    if (chunk.isTag && double.indexOf(chunk.tag) > -1) {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag && prevChunk.tag == chunk.tag) {
        markdownChunks.removeChunk(position);
        position--;
        continue;
      }
    }
  }

}
