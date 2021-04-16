import 'colors';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as Diff from 'diff';
import {LocalFile} from '../src/storage/LocalFilesStorage';

export function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
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
