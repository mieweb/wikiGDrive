import {MarkdownChunks} from '../MarkdownChunks.ts';

function isPreBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}');
}

function isPreEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}');
}

export function postProcessPreMacros(markdownChunks: MarkdownChunks) {
  for (let position = 1; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

    if (chunk.isTag === false && chunk.mode === 'md') {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk.isTag === false && prevChunk.mode === 'md') {
        prevChunk.text = prevChunk.text + chunk.text;
        markdownChunks.removeChunk(position);
        position-=2;
        continue;
      }
    }

    if (chunk.isTag === false && isPreBeginMacro(chunk.text)) {
      const prevChunk = markdownChunks.chunks[position - 1];
      if (prevChunk && prevChunk.isTag && prevChunk.tag === 'PRE') {
        markdownChunks.chunks.splice(position + 1, 0, {
          isTag: true,
          tag: 'PRE',
          mode: 'md',
          payload: {}
        });
        markdownChunks.removeChunk(position - 1);
        position--;
        continue;
      }
    }

    if (chunk.isTag === false && isPreEndMacro(chunk.text)) {
      const postChunk = markdownChunks.chunks[position + 1];
      if (postChunk && postChunk.isTag && postChunk.tag === '/PRE') {
        markdownChunks.removeChunk(position + 1);
        markdownChunks.chunks.splice(position, 0, {
          isTag: true,
          tag: '/PRE',
          mode: 'md',
          payload: {}
        });
      }
    }
  }
}
