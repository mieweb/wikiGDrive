import {MarkdownNodes} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';

function isPreBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}');
}

function isPreEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}');
}

export function postProcessPreMacros(markdownChunks: MarkdownNodes) {

  let inHtml = false;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = true;
      return;
    }

    if (inHtml) {
      return;
    }

    if (chunk && chunk.isTag && ['P'].includes(chunk.tag)) {
      let firstChildIdx = -1;
      for (let idx = 0; idx < chunk.children.length; idx++) {
        const child = chunk.children[idx];
        if (firstChildIdx === -1) {
          //           if (innerTxt === '{{/rawhtml}}' || isMarkdownEndMacro(innerTxt)) {
          if (child.isTag === false && child.text === '{{rawhtml}}') {
            firstChildIdx = idx;
          }
          continue;
        }

        if (child.isTag && chunk.tag === 'HTML_MODE/') {
          firstChildIdx = -1;
          continue;
        }

        if (firstChildIdx > -1 && child.isTag === false && child.text === '{{/rawhtml}}') {
          const afterFirst = chunk.children[firstChildIdx + 1];
          if (afterFirst.isTag && afterFirst.tag === 'EOL/') {
            firstChildIdx++;
          }

          const lastChildIdx = idx;

          const rawMode = markdownChunks.createNode('RAW_MODE/');
          const children = chunk.children.splice(firstChildIdx + 1, lastChildIdx - firstChildIdx - 1, rawMode);

          rawMode.children.splice(0, 0, ...children);

          idx -= children.length;

          firstChildIdx = -1;
          continue;
        }



      }
    }


    if (chunk && chunk.isTag && chunk.tag === 'PRE') {
      const firstChild = chunk.children[0];
      const lastChild = chunk.children[chunk.children.length - 1];

      if (firstChild && firstChild.isTag === false && isPreBeginMacro(firstChild.text) &&
        lastChild && lastChild.isTag === false && isPreEndMacro(lastChild.text)) {

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
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
