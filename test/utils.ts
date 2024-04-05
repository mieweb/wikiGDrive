import fs from 'fs';
import os from 'os';
import path from 'path';
import {createPatch} from 'diff';
import {ansi_colors} from '../src/utils/logger/colors.ts';

export function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function trailSpacesReplacer(x) {
  x = x.replace(/\n/g, '');
  return '\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7'.substring(0, x.length);
}

function consoleColorPatch(patch: string) {
  for (const line of patch.split('\n')) {
    if (line.startsWith('-')) {
      console.log(ansi_colors.red(line));
      continue;
    }
    if (line.startsWith('+')) {
      console.log(ansi_colors.green(line));
      continue;
    }
    console.log(line);
  }
}

export function compareTexts(input, output, ignoreWhitespace = true, fileName = 'file.txt') {
  if (!ignoreWhitespace) {
    const patch = createPatch(fileName, input, output, 'oldHeader', 'newHeader', { ignoreWhitespace: false, newlineIsToken: true });
    if (patch.indexOf('@@') > -1) {
      consoleColorPatch(patch);
      return false;
    }
    return true;
  }

  if (ignoreWhitespace) {
    input = input.split('\n').map(line => line.replace(/[\s]+$/, '')).join('\n');
    output = output.split('\n').map(line => line.replace(/[\s]+$/, '')).join('\n');
  }

  const patch = createPatch(fileName, input, output, 'oldHeader', 'newHeader', { ignoreWhitespace: true, newlineIsToken: false });
  if (patch.indexOf('@@') > -1) {
    consoleColorPatch(patch);
    return false;
  }
  return true;
}

export function compareObjects(obj1, obj2, prefix = '') {
  const set = new Set<string>();
  Object.keys(obj1).forEach(k => set.add(k));
  Object.keys(obj2).forEach(k => set.add(k));

  let same = true;

  for (const k of Array.from(set)) {
    const fullKey = prefix ? prefix + '.' + k : k;
    if (!(k in obj1)) {
      console.error(`${fullKey} missing on left side`);
      same = false;
      continue;
    }
    if (!(k in obj2)) {
      console.error(`${fullKey} missing on right side`);
      same = false;
      continue;
    }
    if (typeof obj1[k] !== typeof obj2[k]) {
      console.error(`'${fullKey}' types mismatch: ${typeof obj1[k]} ${typeof obj2[k]}`);
      same = false;
      continue;
    }
    if (Array.isArray(obj1[k])) {
      if (obj1[k].length !== obj2[k].length) {
        console.error(`'${fullKey}' array length mismatch: ${obj1[k]} ${obj2[k]}`);
        same = false;
        continue;
      }

      for (let i = 0; i < obj1[k].length; i++) {
        if (!compareObjects(obj1[k][i], obj2[k][i], `${fullKey}[${i}]`)) {
          same = false;
        }
      }
      continue;
    }
    if (typeof obj1[k] === 'object') {
      if (!compareObjects(obj1[k], obj2[k], `${fullKey}`)) {
        same = false;
      }
      continue;
    }
    if (obj1[k] !== obj2[k]) {
      console.error(`different value for ${fullKey}: ${obj1[k]} ${obj2[k]}`);
      same = false;
      continue;
    }
  }

  return same;
}
