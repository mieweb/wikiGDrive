import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

function isPreBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}');
}

function isPreEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}');
}

export function postProcessPreMacros(markdownChunks: MarkdownNodes) {

  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk && chunk.isTag && chunk.tag === 'PRE') {
      const firstChild = chunk.children[0];
      const lastChild = chunk.children[chunk.children.length - 1];

      if (firstChild.isTag === false && isPreBeginMacro(firstChild.text) &&
        lastChild.isTag === false && isPreEndMacro(lastChild.text)) {

        chunk.children.splice(0, 1);
        chunk.children.splice(chunk.children.length - 1, 1);

        chunk.parent.children.splice(ctx.nodeIdx + 1, 0, lastChild);
        chunk.parent.children.splice(ctx.nodeIdx, 0, firstChild);
      }
    }

/*
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
  });

    for (let position = 1; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];

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
   */
  });
}
