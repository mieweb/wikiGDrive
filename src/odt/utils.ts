export function spaces(num: number) {
  return '                                                                '.substring(0, num || 0);
}

export function inchesToSpaces(value): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith('in')) {
    return Math.floor(parseFloat(value.substring(0, value.length - 2)) / 0.125);
  }
  return 0;
}

export function inchesToMm(value): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith('pt')) {
    return parseFloat(value.substring(0, value.length - 2)) * 0.3528;
  }
  if (value.endsWith('in')) {
    return parseFloat(value.substring(0, value.length - 2)) * 25.4;
  }
  if (value.endsWith('em')) {
    return parseFloat(value.substring(0, value.length - 2)) / 0.125 * 25.4;
  }
  return 0;
}

export function inchesToPixels(value): number {
  if (!value) {
    return 0;
  }
  return Math.floor(100 * inchesToMm(value));
}

export function fixCharacters(text) {
  return text
    .replace(/’/g, '\'')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    // deno-lint-ignore no-control-regex
    .replace(/\x0b/g, ' ')
    .replace(/\u201d/g, '"')
    .replace(/\u201c/g, '"');
}
