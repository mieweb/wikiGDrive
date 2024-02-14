import {MarkdownChunks} from '../MarkdownChunks.js';

export function fixSpacesInsideInlineFormatting(markdownChunks: MarkdownChunks) {
  for (let position = 1; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag && ['/B', '/I'].indexOf(chunk.tag) > -1) {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag === false && prevChunk.mode === 'md') {
        const text = prevChunk.text;
        const removedTrailingSpaces = text.replace(/[\s]+$/, '');
        const spaces = text.substring(removedTrailingSpaces.length);
        if (spaces.length > 0) {
          prevChunk.text = removedTrailingSpaces;
          markdownChunks.chunks.splice(position + 1, 0, {
            isTag: false,
            mode: 'md',
            text: spaces
          });
          position++;
        }
      }
    }
  }
}
