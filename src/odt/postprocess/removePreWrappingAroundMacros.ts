import {MarkdownChunks} from '../MarkdownChunks.ts';
import {isMarkdownBeginMacro, isMarkdownEndMacro} from '../StateMachine.ts';

export function removePreWrappingAroundMacros(markdownChunks: MarkdownChunks) {
  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag === false && isMarkdownBeginMacro(chunk.text)) {
      const prevChunk = markdownChunks.chunks[position - 1];
      const postChunk = markdownChunks.chunks[position + 1];
      if (prevChunk.isTag && prevChunk.tag === 'PRE' && postChunk.isTag && postChunk.tag === '/PRE') {
        markdownChunks.removeChunk(position - 1);
        postChunk.tag = 'PRE';
        position--;
        continue;
      }
    }

    if (chunk.isTag === false && isMarkdownEndMacro(chunk.text)) {
      const preChunk = markdownChunks.chunks[position - 1];
      const postChunk = markdownChunks.chunks[position + 1];
      if (preChunk.isTag && preChunk.tag === 'PRE' && postChunk.isTag && postChunk.tag === '/PRE') {
        preChunk.tag = '/PRE';
        markdownChunks.removeChunk(position + 1);
        position--;
        continue;
      }
    }
  }
}
