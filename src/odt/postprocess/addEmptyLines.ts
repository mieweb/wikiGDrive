import {MarkdownChunks} from '../MarkdownChunks.ts';

export function addEmptyLines(markdownChunks: MarkdownChunks) {

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (position + 1 < markdownChunks.chunks.length && chunk.isTag && ['/H1', '/H2', '/H3', '/H4', 'IMG/', 'SVG/', '/UL'].indexOf(chunk.tag) > -1) {
      const nextTag = markdownChunks.chunks[position + 1];

      if (chunk.tag === '/UL' && chunk.payload.listLevel !== 1) {
        continue;
      }
      if (chunk.tag === '/UL' && nextTag.isTag && nextTag.tag === 'UL') {
        continue;
      }
      if (chunk.tag === '/UL' && nextTag.isTag && nextTag.tag === 'P') {
        // continue;
      }

      // if (nextTag.isTag && nextTag.tag === 'IMG/') {
      //   markdownChunks.chunks.splice(position + 1, 0, {
      //     isTag: true,
      //     mode: 'md',
      //     tag: 'EMPTY_LINE/',
      //     payload: {},
      //     comment: 'addEmptyLines.ts: Between images'
      //   });
      //   // position+=2;
      //   continue;
      // }
      if (!(nextTag.isTag && nextTag.tag === 'BR/') && !(nextTag.isTag && nextTag.tag === '/TD') && !(nextTag.isTag && nextTag.tag === 'EMPTY_LINE/')) {
        markdownChunks.chunks.splice(position + 1, 0, {
          isTag: true,
          mode: 'md',
          tag: 'EMPTY_LINE/',
          payload: {},
          comment: 'addEmptyLines.ts: Add empty line after: ' + chunk.tag
        });
      }
    }

    // listLevel

    if (position > 1 && chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'IMG/', 'SVG/', 'UL'].indexOf(chunk.tag) > -1) {
      const prevTag = markdownChunks.chunks[position - 1];

      if (chunk.tag === 'UL' && chunk.payload.listLevel !== 1) {
        continue;
      }
      if (chunk.tag === 'UL' && prevTag.isTag && prevTag.tag === '/UL') {
        continue;
      }
      if (chunk.tag === 'UL' && prevTag.isTag && prevTag.tag === '/P') {
        // continue;
      }

      if (!(prevTag.isTag && prevTag.tag === 'BR/') && !(prevTag.isTag && prevTag.tag === 'TD') && !(prevTag.isTag && prevTag.tag === 'EMPTY_LINE/')) {
        markdownChunks.chunks.splice(position, 0, {
          isTag: true,
          mode: 'md',
          tag: 'EMPTY_LINE/',
          // payload: {},
          comment: 'addEmptyLines.ts: Add empty line before: ' + chunk.tag,
          payload: {}
        });
        // markdownChunks.chunks.splice(position, 0, {
        //   isTag: false,
        //   mode: 'md',
        //   text: '\n',
        //   // payload: {},
        //   comment: 'addEmptyLines.ts: Add empty line before: ' + chunk.tag
        // });
        position++;
      }
    }
  }

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (!(chunk.isTag && chunk.tag === 'IMG/' && chunk.mode === 'md')) {
      continue;
    }

    const nextTag = markdownChunks.chunks[position + 1];
    if (!(nextTag.isTag && nextTag.tag === 'BR/' && nextTag.mode === 'md')) {
      continue;
    }

    markdownChunks.chunks.splice(position + 1, 1, {
      isTag: true,
      mode: 'md',
      tag: 'EMPTY_LINE/',
      payload: {},
      comment: 'addEmptyLines.ts: Between images /P'
    }, {
      isTag: true,
      mode: 'md',
      tag: 'EMPTY_LINE/',
      payload: {},
      comment: 'addEmptyLines.ts: Between images /P'
    });
  }

}
