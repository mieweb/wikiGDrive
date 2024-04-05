import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function removeExcessiveLines(markdownChunks: MarkdownNodes) {

  let inHtml = 0;
  walkRecursiveSync(markdownChunks.body, (chunk) => {
    if (chunk.parent && chunk.parent.tag !== 'BODY') {
      return;
    }

    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml++;
      return;
    }

    if (inHtml) {
      return;
    }


  }, {}, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml--;
      return;
    }

    if (chunk.isTag && ['P', 'BODY'].includes(chunk.tag)) {

      for (let idx = 0; idx < chunk.children.length; idx++) {
        const child = chunk.children[idx];
        if (child.isTag && child.tag === 'BR/') {
          const prevChild = chunk.children[idx - 1];
          const nextChild = chunk.children[idx + 1];

          if (nextChild && nextChild.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(nextChild.tag)) {
            child.comment = 'removeExcessiveLines.ts: converted BR/ to EOL/';
            child.tag = 'EOL/';
          } else
          if (prevChild && prevChild.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(prevChild.tag)) {
            child.comment = 'removeExcessiveLines.ts: converted BR/ to EOL/';
            child.tag = 'EOL/';
          }
        }
      }

      for (let idx = chunk.children.length - 1; idx > 0; idx--) {
        const child = chunk.children[idx];
        const prevChild = chunk.children[idx - 1];
        const nextChild = chunk.children[idx + 1];

        if (prevChild && !(prevChild.isTag && prevChild.tag === 'BR/')) {
          continue;
        }

        if (child.isTag && child.tag === 'BR/') {
          if ((nextChild && nextChild.isTag && nextChild.tag === 'IMG/')) {
            const eol = markdownChunks.createNode('EOL/');
            eol.comment = 'removeExcessiveLines.ts: Converted BR/ to EOL/';
            chunk.children.splice(idx, 1, eol);
            continue;
          }

          const eol = markdownChunks.createNode('EOL/');
          eol.comment = 'removeExcessiveLines.ts: Converted BR/ to EOL/ + EMPTY_LINE/';
          const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
          emptyLine.comment = 'removeExcessiveLines.ts: Converted BR/ to EOL/ + EMPTY_LINE/';
          chunk.children.splice(idx, 1, eol, emptyLine);
        }
      }

      for (let idx = chunk.children.length - 1; idx > 0; idx--) {
        const child = chunk.children[idx];
        const prevChild = chunk.children[idx - 1];

/*
        if (child.isTag && child.tag === 'BR/') {
          if (prevChild.isTag && ['BR/', 'EOL/', 'EMPTY_LINE/'].includes(prevChild.tag)) {
            child.tag = 'EMPTY_LINE/';
            child.comment = 'removeExcessiveLines.ts: converted BR/ to EMPTY_LINE/';
            idx += 2;
            continue;
          }
        }
*/

        if (child.isTag && child.tag === 'EOL/') {
          if (prevChild.isTag && ['EOL/', 'EMPTY_LINE/'].includes(prevChild.tag)) {
            child.tag = 'EMPTY_LINE/';
            child.comment = 'removeExcessiveLines.ts: converted EOL/ to EMPTY_LINE/';
            idx++;
          }
        }
      }
    }

    if (chunk.isTag && ['P', 'BODY', 'H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) {
      if (chunk.children.length > 0) {
        const child = chunk.children[0];
        if (child.isTag && child.tag === 'EOL/') {
          child.tag = 'EMPTY_LINE/';
          child.comment = 'removeExcessiveLines.ts: converted first EOL/ to EMPTY_LINE/';
        }
      }
    }

    if (chunk.isTag && ['P', 'LI', 'UL'].includes(chunk.tag)) {
      for (let idx = chunk.children.length - 1; idx > 0; idx--) {
        const child = chunk.children[idx];
        const prevChild = chunk.children[idx - 1];

        if (child.isTag && child.tag === 'EMPTY_LINE/') {
          if (prevChild.isTag && prevChild.tag === 'EMPTY_LINE/') {
            chunk.children.splice(idx, 1);
          }
        }
      }

      for (let idx = chunk.children.length - 1; idx >= 0; idx--) {
        const child = chunk.children[idx];

        if (child.isTag && child.tag === 'EMPTY_LINE/') {
          chunk.children.splice(idx, 1);

          if (chunk.tag === 'P') {
            child.comment = 'removeExcessiveLines.ts: moved EMPTY_LINE/ to parent';
            chunk.parent.children.splice(ctx.nodeIdx + 1, 0, child);
          }
        } else {
          break;
        }
      }

      if (chunk.children.length > 0) {
        const child = chunk.children[0];

        if (child.isTag && child.tag === 'EMPTY_LINE/') {
          chunk.children.splice(0, 1);
          child.comment = 'removeExcessiveLines.ts: moved EMPTY_LINE/ to parent';

          chunk.parent.children.splice(ctx.nodeIdx, 0, child);
        }
      }
    }

    if (chunk.isTag && ['P', 'BODY', 'H1', 'H2', 'H3', 'H4', 'UL'].includes(chunk.tag)) {
      if (chunk.children.length === 0) {
        chunk.parent.children.splice(ctx.nodeIdx, 1);
        return { nodeIdx: ctx.nodeIdx - 1 };
      }
    }

  });

  for (let idx = markdownChunks.body.children.length - 1; idx > 0; idx--) {
    const child = markdownChunks.body.children[idx];
    const prevChild = markdownChunks.body.children[idx - 1];

    if (child.isTag && child.tag === 'EMPTY_LINE/') {
      if (prevChild.isTag && prevChild.tag === 'EMPTY_LINE/') {
        markdownChunks.body.children.splice(idx, 1);
      }
    }
  }

  while (markdownChunks.body.children.length > 0) {
    const firstChild = markdownChunks.body.children[0];
    if (firstChild.isTag && firstChild.tag === 'EMPTY_LINE/') {
      markdownChunks.body.children.splice(0, 1);
      continue;
    }
    break;
  }

  while (markdownChunks.body.children.length > 0) {
    const firstChild = markdownChunks.body.children[markdownChunks.body.children.length - 1];
    if (firstChild.isTag && firstChild.tag === 'EMPTY_LINE/') {
      markdownChunks.body.children.splice(markdownChunks.body.children.length - 1, 1);
      continue;
    }
    break;
  }

}
