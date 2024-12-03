import test from './tester.ts';

import { getDesiredPath } from '../src/containers/transform/LocalFilesGenerator.ts';

test('test slugified path', (t) => {
  t.is(getDesiredPath('Neat Page #1: My first (& only_page)'), 'neat-page-1-my-first-and-only_page');
  t.is(getDesiredPath('Injection/Immunization'), 'injection-immunization');
  t.is(getDesiredPath('.navigation'), '.navigation');
});
