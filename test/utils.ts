import fs from 'fs';
import os from 'os';
import path from 'path';
import { diffLines } from 'diff';
import chalk from 'chalk';

export function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
}

export function compareTexts(input, output) {
  const diff = diffLines(input, output, {
    ignoreWhitespace: true,
  }).filter(row => (row.added || row.removed) && row.value.replace(/\n/g, '').length > 0);

  for (const part of diff) {
    if (part.added) {
      console.log(chalk.green(part.value));
      continue;
    }
    if (part.removed) {
      console.log(chalk.red(part.value));
      continue;
    }
    console.log(part.value);
  }

  return diff.length === 0;
}

export function compareTextsWithLines(input, output) {
  const diff = diffLines(input, output, {
    ignoreWhitespace: true,
  }).filter(row => (row.added || row.removed));

  diff.forEach(function(part) {
    // process.stdout.write(Math.floor(idx / 2 + 2) + ':\t');
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    process.stdout.write(part.value[color]);
  });

  return diff.length === 0;
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
