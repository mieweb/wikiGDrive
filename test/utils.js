import 'colors';

import * as Diff from 'diff';

export function compareTexts(input, output) {
  const diff = Diff.diffLines(input, output, {
    ignoreWhitespace: true,
  }).filter(row => (row.added || row.removed) && row.value.replace(/\n/g, '').length > 0);

  diff.forEach(function(part) {
    // process.stdout.write(Math.floor(idx / 2 + 2) + ':\t');
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
    process.stdout.write(part.value[color]);
    // console.log('');
  });

  return diff.length === 0;
}
