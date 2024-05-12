import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function unwrapEmptyPre(markdownChunks: MarkdownNodes) {

  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (!chunk.isTag) {
      return;
    }

    if (chunk.isTag === true && ['PRE'].includes(chunk.tag)) {
      let changed = false;
      for (let i = 0; i < chunk.children.length; i++) {
        const child = chunk.children[i];
        if (child.isTag && child.tag === 'EOL/') {
          child.tag = 'EMPTY_LINE/';
          chunk.children.splice(i, 1);
          chunk.parent.children.splice(ctx.nodeIdx - 1, 0, child);
          i--;
          changed = true;
          continue;
        }
        break;
      }
      if (changed) {
        return {
          nodeIdx: ctx.nodeIdx + 1
        };
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });

  inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (!chunk.isTag) {
      return;
    }

    if (chunk.isTag === true && ['PRE'].includes(chunk.tag)) {
      if (chunk.children.length === 0) {
        chunk.parent.children.splice(ctx.nodeIdx, 1);
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
