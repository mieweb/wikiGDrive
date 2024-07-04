import slugify from 'slugify';
import {extractText, walkRecursiveAsync, walkRecursiveSync} from '../markdownNodesUtils.ts';
import {MarkdownNodes, MarkdownTextNode} from '../MarkdownNodes.ts';

export async function rewriteHeaders(markdownChunks: MarkdownNodes): Promise<{ headersMap: {[key: string]: string} }> {
  const headersMap = {};

  let inPre = false;
  await walkRecursiveAsync(markdownChunks.body, async (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && 'PRE' === chunk.tag) {
      inPre = true;
    }

    if (inPre) {
      if (chunk.isTag) {
        for (let j = chunk.children.length - 1; j >= 0; j--) {
          const child = chunk.children[j];
          if (child.isTag && child.tag === 'BOOKMARK/') {
            chunk.children.splice(j, 1);
            break;
          }
        }
      }
    }

    if (chunk.isTag && ['H1', 'H2', 'H3', 'H4'].includes(chunk.tag)) {
      const innerTxt = extractText(chunk);
      const slug = slugify(innerTxt.trim(), { replacement: '-', lower: true, remove: /[#*+~.,^()'"!:@]/g });

      if (chunk.children.length === 1) {
        const child = chunk.children[0];
        if (child.isTag && child.tag === 'BOOKMARK/') {
          chunk.parent.children.splice(ctx.nodeIdx, 1, child);
          return;
        }
      }
      for (let j = 0; j < chunk.children.length - 1; j++) {
        const child = chunk.children[j];
        if (child.isTag && child.tag === 'BOOKMARK/') {
          const toMove = chunk.children.splice(j, 1);
          if (slug && !headersMap['#' + child.payload.id]) {
            headersMap['#' + child.payload.id] = '#' + slug;
          } else {
            chunk.children.splice(chunk.children.length, 0, ...toMove);
          }
          break;
        }
      }
    }
  }, {}, async (chunk) => {
    if (chunk.isTag && 'PRE' === chunk.tag) {
      inPre = false;
    }
  });

  await walkRecursiveAsync(markdownChunks.body, async (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && 'BOOKMARK/' === chunk.tag) {
      if (chunk.parent.children.length < 2) {
        return;
      }
      const space: MarkdownTextNode = {
        isTag: false,
        text: ' ',
        comment: 'rewriteHeaders.ts: space before anchor'
      };
      chunk.parent.children.splice(ctx.nodeIdx, 0, space);
      return { nodeIdx: ctx.nodeIdx + 1 };
    }
  });

  if (Object.keys(headersMap).length > 0) {
    walkRecursiveSync(markdownChunks.body, (chunk) => {
      if (chunk.isTag === true && chunk.payload?.href) {
        if (headersMap[chunk.payload.href]) {
          chunk.payload.href = headersMap[chunk.payload.href];
        }
      }
    });
  }

  return { headersMap };
}
