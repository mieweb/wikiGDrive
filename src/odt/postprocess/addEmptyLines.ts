import {MarkdownChunks} from '../MarkdownChunks.js';

export function addEmptyLines(markdownChunks: MarkdownChunks) {

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (position + 1 < markdownChunks.chunks.length && chunk.isTag && ['/H1', '/H2', '/H3', '/H4', 'SVG/', '/UL'].indexOf(chunk.tag) > -1) {
      const nextTag = markdownChunks.chunks[position + 1];

      if (!(nextTag.isTag && nextTag.tag === 'BR/') && !(nextTag.isTag && nextTag.tag === '/TD')) {
        markdownChunks.chunks.splice(position + 1, 0, {
          isTag: true,
          mode: 'md',
          tag: 'BR/',
          payload: {},
          comment: 'Next tag is not BR/'
        });
      }
    }

    if (position > 1 && chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'SVG/', 'UL'].indexOf(chunk.tag) > -1) {
      const prevTag = markdownChunks.chunks[position - 1];
      if (!(prevTag.isTag && prevTag.tag === 'BR/') && !(prevTag.isTag && prevTag.tag === 'TD')) {
        markdownChunks.chunks.splice(position, 0, {
          isTag: false,
          mode: 'md',
          text: '\n',
          // payload: {},
          comment: 'Add empty line before: ' + chunk.tag
        });
        position++;
      }
    }
  }

}
