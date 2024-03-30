export function isMarkdownBeginMacro(innerTxt: string) {
  if ('{{markdown}}' === innerTxt) return true;
  if ('{{% markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

export function isMarkdownEndMacro(innerTxt: string) {
  if ('{{/markdown}}' === innerTxt) return true;
  if ('{{% /markdown %}}' === innerTxt) return true;

  if (innerTxt.startsWith('{{% /pre ') && innerTxt.endsWith(' %}}')) {
    // return true;
  }

  return false;
}

export function isMarkdownMacro(innerTxt: string) {
  const prefix = innerTxt.substring(0, innerTxt.indexOf('}}') + '}}'.length);
  const suffix = innerTxt.substring(innerTxt.lastIndexOf('{{'));
  return isMarkdownBeginMacro(prefix) && isMarkdownEndMacro(suffix);
}

export function stripMarkdownMacro(innerTxt: string) {
  const prefix = innerTxt.substring(0, innerTxt.indexOf('}}') + '}}'.length);
  const suffix = innerTxt.substring(innerTxt.lastIndexOf('{{'));
  if (isMarkdownBeginMacro(prefix) && isMarkdownEndMacro(suffix)) {
    return innerTxt.substring(prefix.length, innerTxt.length - suffix.length);
  }
  return innerTxt;
}

export function isBeginMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% ') && !innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}

export function isEndMacro(innerTxt: string) {
  return innerTxt.startsWith('{{% /') && innerTxt.endsWith(' %}}');
}
