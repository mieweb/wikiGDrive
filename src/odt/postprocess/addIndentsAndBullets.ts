import {MarkdownChunks} from '../MarkdownChunks.js';
import {spaces} from '../utils.js';

export function addIndentsAndBullets(markdownChunks: MarkdownChunks) {
// ADD indents and bullets
  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag === true && chunk.tag === 'P' && chunk.mode === 'md') {
      const level = (chunk.payload.listLevel || 1) - 1;
      // let indent = spaces(level * 4); GDocs not fully compatible
      // if (chunk.payload.style?.paragraphProperties?.marginLeft) {
      //   indent = spaces(inchesToSpaces(chunk.payload.style?.paragraphProperties?.marginLeft) - 4);
      // }
      const indent = spaces(level * 3);
      const listStr = chunk.payload.bullet ? '* ' : chunk.payload.number > 0 ? `${chunk.payload.number}. ` : '';
      const firstStr = indent + listStr;
      const otherStr = indent + spaces(listStr.length);

      let prevEmptyLine = 1;
      for (let position2 = position + 1; position2 < markdownChunks.length; position2++) {
        const chunk2 = markdownChunks.chunks[position2];
        if (chunk2.isTag === true && chunk2.tag === '/P' && chunk.mode === 'md') {
          position += position2 - position - 1;
          break;
        }

        if (chunk2.isTag === true && ['BR/'].indexOf(chunk2.tag) > -1) {
          prevEmptyLine = 2;
          continue;
        }

        if (chunk2.isTag === false && chunk2.text.startsWith('{{% ') && chunk2.text.endsWith(' %}}')) {
          const innerText = chunk2.text.substring(3, chunk2.text.length - 3);
          if (innerText.indexOf(' %}}') === -1) {
            continue;
          }
        }

        if (prevEmptyLine > 0) {
          markdownChunks.chunks.splice(position2, 0, {
            mode: 'md',
            isTag: false,
            text: prevEmptyLine === 1 ? firstStr : otherStr
          });
          prevEmptyLine = 0;
          position2++;
        }
      }
    }
  }

}
