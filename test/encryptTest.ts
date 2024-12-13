import test from './tester.ts';
import {decrypt, encrypt} from '../src/google/GoogleAuthService.ts';

test('test encryption', (t) => {
  const dec = 'plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123plaintext123';
  const enc = encrypt(dec, 'sikretsikretsikretsikretsikret');
  const dec2 = decrypt(enc, 'sikretsikretsikretsikretsikret');
  t.is(dec, dec2);
});
