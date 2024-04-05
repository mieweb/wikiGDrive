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

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) {
      const nextChunk = chunk.parent.children[ctx.nodeIdx + 1];

      if (!isChunkEmptyLine(nextChunk)) {
        const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
        emptyLine.comment = 'addEmptyLines.ts: after ' + chunk.tag;
        chunk.parent.children.splice(ctx.nodeIdx + 1, 0, emptyLine);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }
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
