import yaml from 'js-yaml';

const pattern = /(^-{3}(?:\r\n|\r|\n)([\w\W]*?)-{3}(?:\r\n|\r|\n))?([\w\W]*)*/;

export function frontmatter(string) {
  const parsed = {
    data: null,
    content: ''
  };

  const matches = string.match(pattern);

  if (matches[2] !== undefined) {
    parsed.data = yaml.load(matches[2]) || {};
  }

  if (matches[3] !== undefined) {
    parsed.content = matches[3];
  }

  return parsed;
}

export const FRONTMATTER_DUMP_OPTS = {
  flowLevel: 9,
  forceQuotes: true,
  styles: {
    '!!null' : 'camelcase'
  }
};
