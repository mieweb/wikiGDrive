import {assertStrictEquals} from 'asserts';
import {absolutizeUrl, relateUrl} from '../src/utils/RelateUrl.ts';

Deno.test('test relateUrl', () => {
  assertStrictEquals(relateUrl('https://example.com/path', 'https://example.com/path'), './');
  assertStrictEquals(relateUrl('https://example.com/path', 'https://example.com/path.md'), '../path.md');
  assertStrictEquals(relateUrl('https://example.com/path', 'https://example2.com/path.md'), 'https://example2.com/path.md');
  assertStrictEquals(relateUrl('/etc/http', '/var/log'), '../../var/log');
  assertStrictEquals(relateUrl('/etc/http', '/etc/log'), '../log');
  assertStrictEquals(relateUrl('content/functions/document-management/documents-and-forms/biometric-data-entry.md', 'content/functions/document-management/scanning-and-indexing/indexing-bubble-forms.md'), '../scanning-and-indexing/indexing-bubble-forms.md');
  assertStrictEquals(relateUrl('somefile.md', 'https://youtube.be/v/xxx'), 'https://youtube.be/v/xxx');
  assertStrictEquals(relateUrl('somefile.md', 'https://youtube.be/v/xxx?que&r=y'), 'https://youtube.be/v/xxx?que&r=y');
});

Deno.test('test absolutizeUrl', () => {
  assertStrictEquals(absolutizeUrl('https://example.com/path', ''), 'https://example.com/path');
  assertStrictEquals(absolutizeUrl('https://example.com/path', '.'), 'https://example.com/path');
  assertStrictEquals(absolutizeUrl('https://example.com/path', '..'), 'https://example.com/');
  assertStrictEquals(absolutizeUrl('https://example.com/path', '../..'), 'https://example.com/');
  assertStrictEquals(absolutizeUrl('https://example.com/path', 'path2'), 'https://example.com/path/path2');
  assertStrictEquals(absolutizeUrl('https://example.com/path/path2', '../..'), 'https://example.com/');
  assertStrictEquals(absolutizeUrl('https://example.com/path/path2', '../../path3'), 'https://example.com/path3');
  assertStrictEquals(absolutizeUrl('https://example.com/path/path2', '../../../path3'), 'https://example.com/path3');
  assertStrictEquals(absolutizeUrl('https://example.com/aaa/bbb/ccc.odt', './doc1.svg'), 'https://example.com/aaa/bbb/doc1.svg');
  assertStrictEquals(absolutizeUrl('https://example.com/aaa/bbb/ccc.odt', 'doc2.svg'), 'https://example.com/aaa/bbb/doc2.svg');
});
