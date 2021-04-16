'use strict';

export function clearShortCodes(markdown) {
  return markdown.replace(/{{[^}]+}}/g, '');
}
