import {MarkdownNodes} from '../MarkdownNodes.ts';
import {spaces} from '../utils.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

export function addIndentsAndBullets(markdownChunks: MarkdownNodes) {
  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk.isTag === true && chunk.tag === 'P') {
      if (!chunk.payload.listLevel) {
        return;
      }

      // const level = (chunk.payload.listLevel || 1) - 1;
      const level = 0;

      if (!chunk.payload.bullet && !(chunk.payload.number > 0) && level === 0) {
        return;
      }

      // let indent = spaces(level * 4); GDocs not fully compatible
      // if (chunk.payload.style?.paragraphProperties?.marginLeft) {
      //   indent = spaces(inchesToSpaces(chunk.payload.style?.paragraphProperties?.marginLeft) - 4);
      // }
      const indent = spaces(level * 3);
      const listStr = chunk.payload.bullet ? '* ' : chunk.payload.number > 0 ? `${chunk.payload.number}. ` : '';
      const firstStr = indent + listStr;
      const otherStr = indent + spaces(listStr.length);

      let prevEmptyLine = 1;
      for (let position2 = ctx.nodeIdx + 1; position2 < chunk.parent.children.length; position2++) {
        const chunk2 = chunk.parent.children[position2];
        if (chunk2.isTag === true && chunk2.tag === '/P') {
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
          chunk.parent.children.splice(position2, 0, {
            isTag: false,
            text: prevEmptyLine === 1 ? firstStr : otherStr,
            comment: `addIndentsAndBullets.ts: Indent (${chunk.payload.bullet ? 'bullet' : 'number ' + chunk.payload.number}), level: ` + level + ', prevEmptyLine: ' + (!chunk.payload.bullet && !(chunk.payload.number > 0) && level === 0)
          });
          prevEmptyLine = 0;
          position2++;
          return;
        }
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });

/*
  let lastItem = null;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag === true && chunk.tag === 'LI' && chunk.mode === 'md') {
      lastItem = chunk;
    }

    if (chunk.isTag === true && chunk.tag === 'IMG/' && chunk.mode === 'md') {
      const level = (chunk.payload.listLevel || 1) - 1;

      if (level > 0) {
        let indent = spaces(level * 3);

        if (lastItem.payload.bullet) {
          indent += '  ';
        } else
        if (lastItem.payload.number > 0) {
          indent += '   ';
        }

        chunk.parent.children.splice(ctx.nodeIdx, 0, {
          mode: 'md',
          isTag: false,
          text: indent,
          comment: 'addIndentsAndBullets.ts: Indent image, level: ' + level
        });
      }
      return;
    }
  });
*/

}
