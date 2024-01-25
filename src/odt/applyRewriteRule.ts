import path from 'path';

export interface RewriteRule {
  tag?: string;
  match: string;
  replace?: string;
  template: string;
  mode?: string;
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
  const chunkTag = chunk.tag || '';

  if (rule.tag && chunkTag.replaceAll('/', '').toLowerCase() !== rule.tag.replaceAll('/', '').toLowerCase()) {
    return { shouldBreak: false };
  }

  if (rule.mode && rule.mode.toLowerCase() !== chunk.mode.toLowerCase()) {
    return { shouldBreak: false };
  }

  if (rule.match && rule.match === '$alt') {
    if (href !== alt) {
      return { shouldBreak: false };
    }
  } else
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
