import {MarkdownNodes, MarkdownTagNode} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';
import {getMarkdownEndMacro, isMarkdownBeginMacro} from '../macroUtils.js';

function isPreBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}');
}

function isPreEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}');
}

function getMatching(startText: string) {
  if (startText === '{{rawhtml}}') {
    return '{{/rawhtml}}';
  }

  if (isMarkdownBeginMacro(startText)) {
    return getMarkdownEndMacro(startText);
  }

  return '';
}

function cleanupLines(chunk: MarkdownTagNode) {
  while (chunk.children.length > 0) {
    const child = chunk.children[0];

    if (child.isTag && child.tag === 'EMPTY_LINE/') {
      chunk.children.splice(0, 1);
      // child.comment = 'removeExcessiveLines.ts: moved EMPTY_LINE/ to parent';
      // chunk.parent.children.splice(ctx.nodeIdx, 0, child);
    }

    break;
  }
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
      let startText = '';
      for (let idx = 0; idx < chunk.children.length; idx++) {
        const child = chunk.children[idx];
        if (firstChildIdx === -1) {
          if (child.isTag === false && (child.text === '{{rawhtml}}' || isMarkdownBeginMacro(child.text))) {
            startText = child.text;
            firstChildIdx = idx;
          }
          continue;
        }

        if (child.isTag && chunk.tag === 'HTML_MODE/') {
          firstChildIdx = -1;
          continue;
        }

        if (firstChildIdx > -1 && child.isTag === false && child.text === getMatching(startText)) {
          const afterFirst = chunk.children[firstChildIdx + 1];
          if (afterFirst.isTag && afterFirst.tag === 'EOL/') {
            firstChildIdx++;
          }

          const lastChildIdx = idx;

          const rawMode = markdownChunks.createNode('RAW_MODE/');
          rawMode.comment = 'postProcessPreMacros.ts: enter raw mode after: ' + startText;
          const children = chunk.children.splice(firstChildIdx + 1, lastChildIdx - firstChildIdx - 1, rawMode);

          rawMode.children.splice(0, 0, ...children);

          idx -= children.length;

          firstChildIdx = -1;

          cleanupLines(rawMode);

          continue;
        }
      }
    }

    if (chunk && chunk.isTag && chunk.tag === 'PRE') {
      let firstChildIdx = -1;
      for (let idx = 0; idx < chunk.children.length; idx++) {
        const child = chunk.children[idx];
        if (child.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(child.tag)) {
          continue;
        }
        firstChildIdx = idx;
        break;
      }

      let lastChildIdx = -1;
      for (let idx = chunk.children.length - 1; idx >= 0; idx--) {
        const child = chunk.children[idx];
        if (child.isTag && ['EOL/', 'BR/', 'EMPTY_LINE/'].includes(child.tag)) {
          continue;
        }
        lastChildIdx = idx;
        break;
      }

      if (firstChildIdx === -1 || lastChildIdx === -1) {
        return;
      }

      const firstChild = chunk.children[firstChildIdx];
      const lastChild = chunk.children[lastChildIdx];

      if (firstChild.isTag === false && isPreBeginMacro(firstChild.text) &&
        lastChild.isTag === false && isPreEndMacro(lastChild.text)) {

        const afterFirst = chunk.children[firstChildIdx + 1];
        if (afterFirst.isTag && afterFirst.tag === 'EOL/') {
          firstChildIdx++;
        }

        const after = chunk.children.splice(lastChildIdx, chunk.children.length - lastChildIdx);
        const before = chunk.children.splice(0, firstChildIdx + 1);

        chunk.parent.children.splice(ctx.nodeIdx + 1, 0, ...after);
        chunk.parent.children.splice(ctx.nodeIdx, 0, ...before);
      }
    }
  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml = false;
      return;
    }
  });
}
