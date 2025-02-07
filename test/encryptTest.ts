import test from './tester.ts';
import {decrypt, encrypt} from '../src/google/GoogleAuthService.ts';

test('test encryption', async (t) => {
  const dec = 'plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123';
  const enc = await encrypt(dec, 'sikretsikretsikretsikretsikret');
  const dec2 = await decrypt(enc, 'sikretsikretsikretsikretsikret');
  t.is(dec, dec2);
});
