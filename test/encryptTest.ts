// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import {decrypt, encrypt} from '../src/google/GoogleAuthService.ts';

Deno.test('test encryption', async () => {
  const dec = 'plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123';
  const enc = await encrypt(dec, 'sikretsikretsikretsikretsikret');
  const dec2 = await decrypt(enc, 'sikretsikretsikretsikretsikret');
  assertStrictEquals(dec, dec2);
});
