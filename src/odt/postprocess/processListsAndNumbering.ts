import {MarkdownChunks, TagPayload} from '../MarkdownChunks.ts';

export function processListsAndNumbering(markdownChunks: MarkdownChunks) {

  const counters: { [id: string]: number } = {};
  let preserveMinLevel = 999;

  function fetchListNo(styleName: string) {
    if (counters[styleName]) {
      return counters[styleName];
    }
    return 0;
  }

  function storeListNo(styleName: string, val: number) {
    if (!styleName) {
      return;
    }
    counters[styleName] = val;
  }

  function clearListsNo(styleNamePrefix: string, minLevel: number) {
    for (const k in counters) {
      if (!k.startsWith(styleNamePrefix)) {
        continue;
      }
      const level = parseInt(k.substring(styleNamePrefix.length));
      if (level < minLevel) {
        continue;
      }
      if (level > minLevel + 1) {
        // continue;
      }
      counters[k] = 0;
    }
  }

  function getTopListStyleName(): string {
    for (let i = stack.length - 1; i >=0; i--) {
      const leaf = stack[i];
      if (leaf?.payload?.listStyle?.name) {
        return leaf.payload.listStyle.name;
      }
    }
    return null;
  }

  function topElement<A>(stack: A[]): A {
    if (stack.length === 0) {
      return null;
    }

    return stack[stack.length - 1];
  }

  const stack: Array<{ tag: string, payload: TagPayload }> = [];
  stack.push({
    tag: 'BODY',
    payload: {}
  });

  const margins = {};

  for (let position = 0; position < markdownChunks.length; position++) {
    const chunk = markdownChunks.chunks[position];
    if (!chunk.isTag) {
      continue;
    }

    if (chunk.mode !== 'md') {
      continue;
    }

    const tag = chunk.tag;

    if (['/TOC', '/UL', '/LI', '/P'].includes(tag)) {
      const currentLevel = topElement(stack);
      chunk.payload.listLevel = currentLevel.payload.listLevel;
      stack.pop();

      if (tag === '/UL') {
        // this.listLevel--;
        preserveMinLevel = 999;
      }

      continue;
    }

    const parentLevel = topElement(stack);

    if (['TOC', 'UL', 'LI', 'P'].includes(tag)) {
      stack.push({
        tag,
        payload: chunk.payload
      });
    } else {
      continue;
    }

    const listLevel = stack.filter(item => item.tag === 'UL').length;

    const currentElement = topElement(stack);

    if (currentElement.tag === 'UL') {
      currentElement.payload.listLevel = listLevel;

      if (currentElement.payload.continueNumbering || currentElement.payload.continueList) {
        preserveMinLevel = listLevel;
      }

      if (!(preserveMinLevel <= listLevel)) {
        clearListsNo((currentElement.payload.listStyle?.name || getTopListStyleName()) + '_', listLevel);
      }
    }

    if (tag === 'LI') {
      if (parentLevel?.tag === 'UL') {
        currentElement.payload.listLevel = parentLevel.payload.listLevel;
        const listStyleName = (currentElement.payload.listStyle?.name || getTopListStyleName()) + '_' + currentElement.payload.listLevel;
        currentElement.payload.number = currentElement.payload.number || fetchListNo(listStyleName);
        currentElement.payload.number++;
        storeListNo(listStyleName, currentElement.payload.number);
      }
    }

    if (tag === 'P') {
      const currentMode = chunk.mode;
      switch (currentMode) {
        case 'md':
          if (parentLevel?.tag === 'TOC') {
            currentElement.payload.bullet = true;
          }

          if (parentLevel?.tag === 'LI') {

            if (!margins[currentElement.payload.marginLeft]) {
              margins[currentElement.payload.marginLeft] = listLevel;
            }

            let level = parentLevel.payload.listLevel;
            if (margins[currentElement.payload.marginLeft]) {
              level = margins[currentElement.payload.marginLeft];
            }


            const listStyle = parentLevel.payload.listStyle || currentElement.payload.listStyle;
            const isNumeric = !!(listStyle?.listLevelStyleNumber && listStyle.listLevelStyleNumber.find(i => i.level == level));

            currentElement.payload.listLevel = level;

            if (isNumeric) {
              currentElement.payload.number = parentLevel.payload.number;
            } else {
              currentElement.payload.bullet = true;
            }
          }
          break;
      }
    }
  }

}
