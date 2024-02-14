import {MarkdownChunks} from '../MarkdownChunks.js';

export function fixListParagraphs(markdownChunks: MarkdownChunks) {
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
}
