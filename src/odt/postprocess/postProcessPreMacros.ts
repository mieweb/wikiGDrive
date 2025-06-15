import {MarkdownNodes, MarkdownTagNode} from '../MarkdownNodes.ts';
import {walkRecursiveSync} from '../markdownNodesUtils.ts';
import {getEndMacro, getMarkdownEndMacro, isBeginMacro, isMarkdownBeginMacro} from '../macroUtils.ts';

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

  if (isBeginMacro(startText)) {
    return getEndMacro(startText);
  }

  return '';
}

function cleanupLines(chunk: MarkdownTagNode) {
  while (chunk.children.length > 0) {
    const child = chunk.children[0];
    if (child.isTag && ['EMPTY_LINE/', 'EOL/'].includes(child.tag)) {
      chunk.children.splice(0, 1);
      continue;
    }
    break;
  }

  for (let idx = chunk.children.length - 1; idx >= 1; idx--) {
    const child = chunk.children[idx];
    const prevChild = chunk.children[idx - 1];

    if (child.isTag && child.tag === 'EOL/') {
      if (prevChild.isTag && prevChild.tag === 'EOL/') {
        child.tag = 'EMPTY_LINE/';
        continue;
      }
    }
    break;
  }

  while (chunk.children.length > 0) {
    const child = chunk.children[chunk.children.length - 1];
    if (child.isTag && ['EMPTY_LINE/'].includes(child.tag)) {
      chunk.children.splice(chunk.children.length - 1, 1);
      continue;
    }
    break;
  }
}

// Related tests:
// test ./issue-431
// test ./list-test.md
// test ./list-indent.md
// test ./raw-html.md
// test ./pre-mie.md
// test ./block-macro.md
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
        }
      }
    }

    if (chunk && chunk.isTag && ['P'].includes(chunk.tag)) {
      let firstChildIdx = -1;
      let startText = '';
      for (let idx = 0; idx < chunk.children.length; idx++) {
        const child = chunk.children[idx];
        if (firstChildIdx === -1) {
          if (child.isTag === false && isBeginMacro(child.text)) {
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
          if (afterFirst.isTag && ['EOL/', 'BR/'].includes(afterFirst.tag)) {
            afterFirst.tag = 'EOL/';
            firstChildIdx++;
          }

          const lastChildIdx = idx;

          const macroMode = markdownChunks.createNode('MACRO_MODE/');
          macroMode.comment = 'postProcessPreMacros.ts: enter macro mode after: ' + startText;
          const children = chunk.children.splice(firstChildIdx + 1, lastChildIdx - firstChildIdx - 1, macroMode);

          macroMode.children.splice(0, 0, ...children);

          idx -= children.length;

          firstChildIdx = -1;

          walkRecursiveSync(macroMode, chunk => {
            if (chunk.isTag && chunk.tag === 'BR/') {
              chunk.tag = 'EOL/';
              chunk.comment = 'postProcessPreMacros.ts: Converted BR/ to EOL/ inside macro';
            }
          });

          cleanupLines(macroMode);
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
