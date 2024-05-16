import {MarkdownNode, MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

const CODEBLOCK_START = '';
const CODEBLOCK_END = '';

function isCodeBlockPara(chunk: MarkdownNode, type: string) {
  if (chunk.isTag === true && ['P'].includes(chunk.tag)) {
    if (chunk.children.length !== 1) {
      return false;
    }

    const firstChunk = chunk.children[0];

    if ('text' in firstChunk) {
      const txt = firstChunk.text;
      return (txt === type);
    }

  }
  return false;
}

export function convertCodeBlockParagraphs(markdownChunks: MarkdownNodes) {
  walkRecursiveSync(markdownChunks.body, async (node, ctx: { nodeIdx: number }) => {
    if (isCodeBlockPara(node, CODEBLOCK_START)) {
      for (let nodeIdx2 = ctx.nodeIdx + 1; nodeIdx2 < node.parent.children.length; nodeIdx2++) {
        const node2 = node.parent.children[nodeIdx2];
        if (isCodeBlockPara(node2, CODEBLOCK_END)) {
          console.log('hhh', ctx.nodeIdx, nodeIdx2);
          const inner = node.parent.children.splice(ctx.nodeIdx + 1, nodeIdx2 - (ctx.nodeIdx + 1));

          const toInsert = inner.map((part, idx) => {
            if (!part.isTag) {
              const pre = markdownChunks.createNode('PRE');
              pre.children.splice(0, 0, ...inner);
              pre.payload.lang = (idx < inner.length - 1) ? 'codeblock' : 'codeblockend';
              return pre;
            }
            if (part.isTag && part.tag === 'P') {
              part.tag = 'PRE';
              part.payload.lang = (idx < inner.length - 1) ? 'codeblock' : 'codeblockend';
              return part;
            }
            return part;
          });

          const emptyLine = markdownChunks.createNode('EMPTY_LINE/');
          emptyLine.comment = 'addEmptyLines.ts: after codeblock';
          toInsert.push(emptyLine);
          node.parent.children.splice(ctx.nodeIdx, 2, ...toInsert);
          break;
        }
      }
    }
  });
}
