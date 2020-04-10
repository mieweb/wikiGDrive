import { assert } from 'chai';
import { getDesiredPath } from '../src/google/GoogleDriveService';

describe('DesiredPathTest', () => {
  it('test slugified path', () => {
    assert.equal(getDesiredPath('Neat Page #1: My first (& only_page)'), 'neat-page-1-my-first-and-only_page');
  });
});
