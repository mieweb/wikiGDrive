import {MarkdownChunks} from '../MarkdownChunks.js';
import {RewriteRule} from '../applyRewriteRule.js';

export function isBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% ') && !innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}

export function isEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}

export function mergeParagraphs(markdownChunks: MarkdownChunks, rewriteRules: RewriteRule[]) {
  let previousParaPosition = 0;
  const macros = [];
  for (let position = 0; position < markdownChunks.length - 1; position++) {
    const chunk = markdownChunks.chunks[position];

    if (chunk.isTag && chunk.mode === 'md' && chunk.tag === 'P') {
      previousParaPosition = position;
      continue;
    }

    if (chunk.isTag === false && chunk.mode === 'md' && isBeginMacro(chunk.text)) {
      macros.push(chunk.text);
      continue;
    }

    if (chunk.isTag === false && chunk.mode === 'md' && isEndMacro(chunk.text)) {
      continue;
    }

    if (chunk.isTag && chunk.mode === 'md' && chunk.tag === '/P') {
      const nextChunk = markdownChunks.chunks[position + 1];

      if (macros.length > 0) {
        continue;
      }

      if (nextChunk.isTag && nextChunk.mode === 'md' && nextChunk.tag === 'P') {

        let nextParaClosing = 0;
        for (let position2 = position + 1; position2 < markdownChunks.length; position2++) {
          const chunk2 = markdownChunks.chunks[position2];
          if (chunk2.isTag && chunk2.mode === 'md' && chunk2.tag === '/P') {
            nextParaClosing = position2;
            break;
          }
        }

        if (nextParaClosing > 0) {
          const innerText = markdownChunks.extractText(position, nextParaClosing, rewriteRules);
          if (innerText.length === 0) {
            continue;
          }
        }

        if (previousParaPosition > 0) {
          const innerText = markdownChunks.extractText(previousParaPosition, position, rewriteRules);
          if (innerText.length === 0) {
            continue;
          }
          if (innerText.endsWith(' %}}')) {
            continue;
          }
        }

        const findFirstTextAfterPos = (start: number): string | null => {
          for (let pos = start + 1; pos < markdownChunks.chunks.length; pos++) {
            const currentChunk = markdownChunks.chunks[pos];
            if ('text' in currentChunk) {
              return currentChunk.text;
            }
          }
          return null;
        };

        const nextText = findFirstTextAfterPos(nextParaClosing);
        if (nextText === '* ' || nextText?.trim().length === 0) {
          markdownChunks.chunks.splice(position, 2, {
            isTag: false,
            text: '\n',
            mode: 'md',
            comment: 'End of line, but next line is list'
          });
          position--;
          previousParaPosition = 0;
        } else {
          markdownChunks.chunks.splice(position, 2, {
            isTag: true,
            tag: 'BR/',
            mode: 'md',
            payload: {},
            comment: 'End of line, two paras merge together'
          });
          position--;
          previousParaPosition = 0;
        }

      }
    }
  }
}
