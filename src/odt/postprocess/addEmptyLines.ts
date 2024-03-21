import {MarkdownChunks} from '../MarkdownChunks.ts';

/*

EOL/
   is line ending
   There should be some text before this tag

EMPTY_LINE/
   is blank line (it can be merged or removed)
   There should not be any text before this tag, only EOL/ or BR/

BR/
   is intentional line break (2 spaces at the end of line) - shift+enter

*/

function isPreviousChunkEmptyLine(markdownChunks: MarkdownChunks, position: number) {
  const chunk = markdownChunks.chunks[position - 1];
  if (!chunk) {
    return false;
  }

  if (chunk.isTag && 'EMPTY_LINE/' === chunk.tag) {
    return true;
  }

  return false;
}

function isNextChunkEmptyLine(markdownChunks: MarkdownChunks, position: number) {
  const chunk = markdownChunks.chunks[position + 1];
  if (!chunk) {
    return false;
  }

  if (chunk.isTag && 'EMPTY_LINE/' === chunk.tag) {
    return true;
  }
  if (chunk.isTag && 'EOL/' === chunk.tag) {
    return true;
  }

  return false;
}

export function addEmptyLines(markdownChunks: MarkdownChunks) {

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (position + 1 < markdownChunks.chunks.length && chunk.isTag && ['IMG/', 'SVG/'].indexOf(chunk.tag) > -1) {
      const nextTag = markdownChunks.chunks[position + 1];
      if (nextTag.isTag && nextTag.tag === 'IMG/') {
        markdownChunks.chunks.splice(position + 1, 0, {
          isTag: true,
          mode: 'md',
          tag: 'EOL/',
          payload: {},
          comment: 'addEmptyLines.ts: EOL/ after IMG/'
        }, {
          isTag: true,
          mode: 'md',
          tag: 'EMPTY_LINE/',
          payload: {},
          comment: 'addEmptyLines.ts: Between images'
        });
      }
      // position--;
      continue;
    }

    if (position + 1 < markdownChunks.chunks.length && chunk.isTag && ['/H1', '/H2', '/H3', '/H4', '/UL'].indexOf(chunk.tag) > -1) {
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

      if (!isNextChunkEmptyLine(markdownChunks, position) && !isPreviousChunkEmptyLine(markdownChunks, position)) {
        markdownChunks.chunks.splice(position + 1, 0, {
          isTag: true,
          mode: 'md',
          tag: 'EMPTY_LINE/',
          payload: {},
          comment: 'addEmptyLines.ts: Add empty line after: ' + chunk.tag
        });
        position--;
        continue;
      }
      // if (!(nextTag.isTag && nextTag.tag === 'BR/') && !(nextTag.isTag && nextTag.tag === '/TD') && !(nextTag.isTag && nextTag.tag === 'EMPTY_LINE/')) {
      // }
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

      if (!isNextChunkEmptyLine(markdownChunks, position) && !isPreviousChunkEmptyLine(markdownChunks, position)) {
        markdownChunks.chunks.splice(position, 0, {
          isTag: true,
          mode: 'md',
          tag: 'EMPTY_LINE/',
          // payload: {},
          comment: 'addEmptyLines.ts: Add empty line before: ' + chunk.tag + JSON.stringify(prevTag),
          payload: {}
        });
        position++;
      }

      if (!(prevTag.isTag && prevTag.tag === 'BR/') && !(prevTag.isTag && prevTag.tag === 'TD') && !(prevTag.isTag && prevTag.tag === 'EMPTY_LINE/')) {
        // markdownChunks.chunks.splice(position, 0, {
        //   isTag: false,
        //   mode: 'md',
        //   text: '\n',
        //   // payload: {},
        //   comment: 'addEmptyLines.ts: Add empty line before: ' + chunk.tag
        // });
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
      tag: 'EOL/',
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
