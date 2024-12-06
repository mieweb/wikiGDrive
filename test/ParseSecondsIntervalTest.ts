import {parseSecondsInterval} from '../src/utils/parseSecondsInterval.ts';

import test from './tester.ts';

test('test collisions', async (t) => {
  t.is(parseSecondsInterval('7'), 0);
  t.is(parseSecondsInterval('7s'), 7);
  t.is(parseSecondsInterval('7m'), 7 * 60);
  t.is(parseSecondsInterval('7h'), 7 * 60 * 60);
  t.is(parseSecondsInterval('7d'), 7 * 60 * 60 * 24);
  t.is(parseSecondsInterval('7w'), 7 * 60 * 60 * 24 * 7);
});
