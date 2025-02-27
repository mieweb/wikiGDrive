// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import {parseSecondsInterval} from '../src/utils/parseSecondsInterval.ts';

Deno.test('test collisions', async () => {
  assertStrictEquals(parseSecondsInterval('7'), 0);
  assertStrictEquals(parseSecondsInterval('7s'), 7);
  assertStrictEquals(parseSecondsInterval('7m'), 7 * 60);
  assertStrictEquals(parseSecondsInterval('7h'), 7 * 60 * 60);
  assertStrictEquals(parseSecondsInterval('7d'), 7 * 60 * 60 * 24);
  assertStrictEquals(parseSecondsInterval('7w'), 7 * 60 * 60 * 24 * 7);
});
