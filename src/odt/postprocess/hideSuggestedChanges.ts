import {MarkdownChunks} from '../MarkdownChunks.ts';

export function hideSuggestedChanges(markdownChunks: MarkdownChunks) {
  let inChange = false;
  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (chunk.isTag && chunk.tag === 'CHANGE') {
      inChange = true;
      markdownChunks.removeChunk(position);
      // position--;
      continue;
    }
    if (chunk.isTag && chunk.tag === '/CHANGE') {
      inChange = false;
      markdownChunks.removeChunk(position);
      // position--;
      continue;
    }

    if (inChange) {
      markdownChunks.removeChunk(position);
      // position--;
    }
  }

}
