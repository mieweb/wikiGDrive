import 'colors';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as Diff from 'diff';

export function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
}

export class DummyConfig {

  constructor() {
    this.fileMap = {};
  }

  async loadFileMap() {
    return this.fileMap;
  }

  async putFile(id, file) {
    this.fileMap[id] = file;
  }
}

export function compareTexts(input, output) {
  const diff = Diff.diffLines(input, output, {
    ignoreWhitespace: true,
  }).filter(row => (row.added || row.removed) && row.value.replace(/\n/g, '').length > 0);

  diff.forEach(function(part) {
    // process.stdout.write(Math.floor(idx / 2 + 2) + ':\t');
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    process.stdout.write(part.value[color]);
  });

  return diff.length === 0;
}

export function compareTextsWithLines(input, output) {
  const diff = Diff.diffLines(input, output, {
    ignoreWhitespace: true,
  }).filter(row => (row.added || row.removed));

  diff.forEach(function(part) {
    // process.stdout.write(Math.floor(idx / 2 + 2) + ':\t');
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    process.stdout.write(part.value[color]);
  });

  return diff.length === 0;
}
