import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.js';

export function fixListParagraphs(markdownChunks: MarkdownNodes) {

  // Inside list item tags like <strong> needs to be html tags
  let inHtml = false;

  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { level: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag && ['LI'].includes(chunk.tag)) {
      if (chunk.children.length === 0) {
        return;
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });

  /* TODO: WTF?
  let nextPara = null;
  for (let position = markdownChunks.length - 1; position >= 0; position--) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag && chunk.tag === 'P') {
      if (nextPara) {
        if (nextPara.payload?.listLevel && !chunk.payload?.listLevel) {
          chunk.payload.listLevel = nextPara?.payload?.listLevel;
        }
        if (!chunk.payload?.bullet && nextPara.payload?.number === chunk.payload?.number && nextPara.payload?.listLevel === chunk.payload?.listLevel) {
          delete nextPara.payload.number;
        }
      }
      nextPara = chunk;
    }
  }
  */
}
