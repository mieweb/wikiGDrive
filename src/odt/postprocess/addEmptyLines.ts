import {MarkdownNode, MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

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

function isPreviousChunkEmptyLine(markdownChunks: MarkdownNodes, position: number) {
  const chunk = markdownChunks.chunks[position - 1];
  if (!chunk) {
    return false;
  }

  if (chunk.isTag && 'EMPTY_LINE/' === chunk.tag) {
    return true;
  }

  return false;
}

function isNextChunkEmptyLine(markdownChunks: MarkdownNodes, position: number) {
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

function isChunkEmptyLine(chunk: MarkdownNode) {
  if (!chunk) {
    return false;
  }

  if (chunk.isTag && 'EMPTY_LINE/' === chunk.tag) {
    return true;
  }
  if (chunk.isTag && 'BR/' === chunk.tag) {
    return true;
  }
  if (chunk.isTag && 'EOL/' === chunk.tag) {
    // return true;
  }

  return false;
}



export function addEmptyLines(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.parent && chunk.parent.tag !== 'BODY') {
      return;
    }

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'IMG/', 'SVG/'].includes(chunk.tag)) {
      const prevChunk = chunk.parent.children[ctx.nodeIdx - 1];

      if (chunk.tag === 'UL') {
        if ((chunk.payload.continueNumbering || chunk.payload.number > 1)) {
          if (prevChunk && prevChunk.isTag && prevChunk.tag === 'UL') {
            return;
          }
        } else {
          if (prevChunk && prevChunk.isTag && prevChunk.tag === 'UL' && !prevChunk.payload.number) {
            return;
          }
        }
      }

      if (!isChunkEmptyLine(prevChunk)) {
        const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
        emptyLine.comment = 'addEmptyLines.ts: before ' + chunk.tag;
        chunk.parent.children.splice(ctx.nodeIdx, 0, emptyLine);
        return { nodeIdx: ctx.nodeIdx + 1 };
      }

      // chunk.parent.children.splice(ctx.nodeIdx, 1);
      // return { nodeIdx: ctx.nodeIdx - 1 };
    }

  });

  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && chunk.parent?.tag === 'P') {

      if (chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'IMG/', 'SVG/'].includes(chunk.tag)) {
        const prevChunk = chunk.parent.children[ctx.nodeIdx - 1];

        if (chunk.tag === 'UL' && (chunk.payload.continueNumbering || chunk.payload.number > 1)) {
          if (prevChunk && prevChunk.isTag && prevChunk.tag === 'UL') {
            return;
          } else {
            if (prevChunk && prevChunk.isTag && prevChunk.tag === 'UL' && !prevChunk.payload.number) {
              return;
            }
          }
        }

        if (chunk.isTag && ['IMG/', 'SVG/'].includes(chunk.tag)) {
          const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];
          if (!(nextChunk.isTag && nextChunk.tag === 'EOL/')) {
            chunk.parent.children.splice(ctx.nodeIdx + 1, 0, markdownChunks.createNode('EOL/'));
            return { nodeIdx: ctx.nodeIdx - 1 };
          }
        }

        if (!isChunkEmptyLine(prevChunk)) {
          const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
          emptyLine.comment = 'addEmptyLines.ts: inside P, before ' + chunk.tag;
          chunk.parent.children.splice(ctx.nodeIdx, 0, emptyLine);
          return { nodeIdx: ctx.nodeIdx + 1 };
        }

        // chunk.parent.children.splice(ctx.nodeIdx, 1);
        // return { nodeIdx: ctx.nodeIdx - 1 };
      }

    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });

  return;

  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (!chunk.parent) {
      return;
    }

    const prevTag = chunk.parent?.children[ctx.nodeIdx - 1] || null;
    const nextTag = chunk.parent?.children[ctx.nodeIdx + 1] || null;
    if (chunk.isTag && ['IMG/', 'SVG/'].indexOf(chunk.tag) > -1 && nextTag) {
      if (nextTag.isTag && nextTag.tag === 'IMG/') {
        chunk.parent.children.splice(ctx.nodeIdx + 1, 0, {
          ...markdownChunks.createNode('EOL/'),
          comment: 'addEmptyLines.ts: EOL/ after IMG/'
        }, {
          ...markdownChunks.createNode('EMPTY_LINE/'),
          comment: 'addEmptyLines.ts: Between images'
        });
      }
      return;
    }

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'UL'].indexOf(chunk.tag) > -1 && nextTag) {
      if (chunk.tag === 'UL' && chunk.payload.listLevel !== 1) {
        return;
      }
      if (chunk.tag === 'UL' && nextTag.isTag && nextTag.tag === 'UL') {
        return;
      }
      if (chunk.tag === 'UL' && nextTag.isTag && nextTag.tag === 'P') {
        // return;
      }
    }

    // if (!isChunkEmptyLine(nextTag) && !isChunkEmptyLine(prevTag)) {
    //   chunk.parent.children.splice(ctx.nodeIdx + 1, 0, {
    //     ...markdownChunks.createNode('EMPTY_LINE/'),
    //     comment: 'addEmptyLines.ts: Add empty line after: ' + (chunk.tag || chunk.text)
    //   });
    //   return;
    // }
    // if (!(nextTag.isTag && nextTag.tag === 'BR/') && !(nextTag.isTag && nextTag.tag === '/TD') && !(nextTag.isTag && nextTag.tag === 'EMPTY_LINE/')) {
    // }

    // listLevel

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4', 'IMG/', 'SVG/', 'UL'].indexOf(chunk.tag) > -1 && nextTag) {
      const prevTag = chunk.parent.children[ctx.nodeIdx - 1];

      if (chunk.tag === 'UL' && chunk.payload.listLevel !== 1) {
        return;
      }
      if (chunk.tag === 'UL' && prevTag && prevTag.isTag && prevTag.tag === 'UL') {
        return;
      }
      if (chunk.tag === 'UL' && prevTag && prevTag.isTag && prevTag.tag === 'P') {
        // return;
      }

      if (!isChunkEmptyLine(nextTag) && !isChunkEmptyLine(prevTag)) {
        chunk.parent.children.splice(ctx.nodeIdx, 0, {
          ...markdownChunks.createNode('EMPTY_LINE/'),
          comment: 'addEmptyLines.ts: Add empty line before: ' + chunk.tag + JSON.stringify({ ...prevTag, children: undefined, parent: undefined })
        });
        return;
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
  });


  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (!(chunk.isTag && chunk.tag === 'IMG/' && chunk.mode === 'md')) {
      return;
    }

    const nextTag = chunk.parent.children[ctx.nodeIdx + 1] || null;
    if (!(nextTag.isTag && nextTag.tag === 'BR/' && nextTag.mode === 'md')) {
      return;
    }

    chunk.parent.children.splice(ctx.nodeIdx + 1, 1, {
      ...markdownChunks.createNode('EOL/'),
      comment: 'addEmptyLines.ts: Between images /P'
    }, {
      ...markdownChunks.createNode('EMPTY_LINE/'),
      comment: 'addEmptyLines.ts: Between images /P'
    });

  });
}
