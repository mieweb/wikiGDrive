import {MarkdownChunks} from '../MarkdownChunks.js';

export function addEmptyLinesAfterParas(markdownChunks: MarkdownChunks) {

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    const nextChunk = markdownChunks.chunks[position + 1] || null;
    const prevChunk = markdownChunks.chunks[position - 1] || null;

    if (chunk.mode !== 'md') {
      continue;
    }

    if (!chunk.isTag) {
      continue;
    }

    if ('/P' === chunk.tag) {
      if (nextChunk && nextChunk.isTag && nextChunk.tag === 'EMPTY_LINE/') {
        // continue;
      }

      if (prevChunk && prevChunk.isTag && prevChunk.tag === 'EMPTY_LINE/') {
        continue;
      }

      markdownChunks.chunks.splice(position + 1, 0, {
        mode: 'md',
        isTag: true,
        tag: 'EOL/',
        comment: 'addEmptyLinesAfterParas.ts: break after para',
        payload: {}
      });
      position++;
    }
  }

}
