import { assert } from 'chai';
import {parseSecondsInterval} from '../src/utils/parseSecondsInterval';

describe('ParseSecondsInterval', () => {
  it('test collisions', async () => {
    assert.equal(parseSecondsInterval('7'), 0);
    assert.equal(parseSecondsInterval('7s'), 7);
    assert.equal(parseSecondsInterval('7m'), 7 * 60);
    assert.equal(parseSecondsInterval('7h'), 7 * 60 * 60);
    assert.equal(parseSecondsInterval('7d'), 7 * 60 * 60 * 24);
    assert.equal(parseSecondsInterval('7w'), 7 * 60 * 60 * 24 * 7);
  });
});
