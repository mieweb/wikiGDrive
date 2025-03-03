// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import { getDesiredPath } from '../src/containers/transform/LocalFilesGenerator.ts';

Deno.test('test slugified path', () => {
  assertStrictEquals(getDesiredPath('Neat Page #1: My first (& only_page)'), 'neat-page-1-my-first-and-only_page');
  assertStrictEquals(getDesiredPath('Injection/Immunization'), 'injection-immunization');
  assertStrictEquals(getDesiredPath('.navigation'), '.navigation');
});
