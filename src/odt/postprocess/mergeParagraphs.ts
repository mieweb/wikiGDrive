import {addComment, MarkdownChunks, TAG} from '../MarkdownChunks.ts';
import {RewriteRule} from '../applyRewriteRule.ts';

export function isBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% ') && !innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}

export function isEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}

export function mergeParagraphs(markdownChunks: MarkdownChunks, rewriteRules: RewriteRule[]) {
  let previousParaOpening = 0;
  const macros = [];

  function findNext(tag: TAG, start: number) {
    let nextParaClosing = 0;
    for (let idx = start + 1; idx < markdownChunks.length; idx++) {
      const chunk = markdownChunks.chunks[idx];
      if (chunk.isTag && chunk.mode === 'md' && chunk.tag === tag) {
        nextParaClosing = idx;
        break;
      }
    }
    return nextParaClosing;
  }

  function findFirstTextAfterPos(start: number): string | null {
    for (let pos = start + 1; pos < markdownChunks.chunks.length; pos++) {
      const currentChunk = markdownChunks.chunks[pos];
      if ('text' in currentChunk && currentChunk.text.trim() !== '') {
        return currentChunk.text;
      }
    }
    return null;
  }

  for (let position = 0; position < markdownChunks.length - 1; position++) {
    const chunk = markdownChunks.chunks[position];

    if (chunk.isTag && chunk.mode === 'md' && chunk.tag === 'P') {
      previousParaOpening = position;
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
        addComment(chunk, 'macros.length > 0');
        continue;
      }

      if (nextChunk.isTag && nextChunk.mode === 'md' && nextChunk.tag === 'P') {
        const nextParaOpening = findNext('P', position);
        const nextParaClosing = findNext('/P', position);

        if (nextParaOpening > 0 && nextParaOpening < nextParaClosing) {
          const innerText = markdownChunks.extractText(nextParaOpening, nextParaClosing, rewriteRules);
          if (innerText.length === 0) {
            // markdownChunks.chunks.splice(nextParaOpening, nextParaClosing - nextParaOpening + 1, {
            //   isTag: true,
            //   tag: 'BR/',
            //   mode: 'md',
            //   comment: 'Converted empty paragraph to BR/',
            //   payload: {}
            // });
            // position--;
            continue;
          }
        }

        if (previousParaOpening > 0) {
          const innerText = markdownChunks.extractText(previousParaOpening, position, rewriteRules);
          if (innerText.length === 0) {
            addComment(chunk, 'innerText.length === 0');
            continue;
          }
          if (innerText.endsWith(' %}}')) {
            addComment(chunk, 'innerText.endsWith(\' %}}\')');
            continue;
          }
        }

        const nextText = findFirstTextAfterPos(position);
        if (nextText === '* ' || nextText?.trim().length === 0) {
          markdownChunks.chunks.splice(position, 2, {
            isTag: false,
            text: '\n',
            mode: 'md',
            comment: 'End of line, but next line is list'
          });
          position--;
          previousParaOpening = 0;
        } else {
          markdownChunks.chunks.splice(position, 2, {
            isTag: true,
            tag: 'BR/',
            mode: 'md',
            payload: {},
            comment: 'End of line, two paras merge together'
          });
          position--;
          previousParaOpening = 0;
        }

      } else {
        addComment(chunk, 'nextChunk is not P');
      }
    }
  }
}
