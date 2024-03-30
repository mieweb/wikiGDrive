import {MarkdownNodes} from '../MarkdownNodes.ts';

export function hideSuggestedChanges(markdownChunks: MarkdownNodes) {
  const body = markdownChunks.body;
  for (let pos1 = 0; pos1 < body.children.length; pos1++) {
    const para1 = body.children[pos1];
    if (!para1.isTag || para1.tag !== 'P') {
      continue;
    }

    let changeStart = -1;
    for (let i = 0; i < para1.children.length; i++) {
      const child = para1.children[i];
      if (child.isTag && child.tag === 'CHANGE_START') {
        changeStart = i;
      }
    }

    if (!changeStart) {
      continue;
    }

    for (let pos2 = pos1 + 1; pos2 < body.children.length; pos2++) {
      const para2 = body.children[pos2];
      if (!para2.isTag || para2.tag !== 'P') {
        continue;
      }

      let changeEnd = -1;
      for (let i = 0; i < para2.children.length; i++) {
        const child = para2.children[i];
        if (child.isTag && child.tag === 'CHANGE_END') {
          changeEnd = i;
        }
      }

      if (changeStart > -1 && changeEnd > -1) {
        para1.children.splice(changeStart, para1.children.length - changeStart);
        para2.children.splice(0, changeEnd + 1);
        body.children.splice(pos1 + 1, pos2 - pos1 - 1);
        break;
      }
    }
  }
}
