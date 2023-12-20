import path from 'path';

export interface RewriteRule {
  tag?: string;
  match: string;
  replace?: string;
  template: string;
}

export interface Chunk {
  mode: string;
  tag?: string;
  href: string;
  alt?: string;
}

export function applyRewriteRule(rule: RewriteRule, chunk: Chunk) {
  const href = chunk.href || '';
  const basename = path.basename(href);
  const alt = chunk.alt || '';

  if (rule.tag && chunk.tag !== rule.tag) {
    return { shouldBreak: false };
  }

  if (rule.match) {
    const matchRegExp = new RegExp(rule.match);
    if (!matchRegExp.test(href)) {
      return { shouldBreak: false };
    }
  }

  let value = href;

  const replaceRegExp = rule.replace ? new RegExp(rule.replace) : undefined;
  if (replaceRegExp) {
    const arr = replaceRegExp.exec(value);
    value = arr[1];
  }

  const text = rule.template
    .replaceAll('$href', href)
    .replaceAll('$basename', basename)
    .replaceAll('$label', alt)
    .replaceAll('$value', value);

  return { shouldBreak: true, text };
}
