import fs from 'node:fs';
// eslint-disable-next-line import/no-unresolved
import { assertStrictEquals } from 'asserts';

import {compareTexts} from '../utils.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';

import {FileContentService} from '../../src/utils/FileContentService.ts';

const __dirname = import.meta.dirname;

Deno.test('test ./issue-431', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/431
  const testMarkdown = fs.readFileSync(__dirname + '/issue-431.md').toString();
  const markdown = await transformOdt('issue-431');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'issue-431.md'));
});

Deno.test('test ./issue-432', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/432
  const testMarkdown = fs.readFileSync(__dirname + '/issue-432.md').toString();
  const markdown = await transformOdt('issue-432');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'issue-432.md'));
});

Deno.test('test ./issue-434', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/434
  const testMarkdown = fs.readFileSync(__dirname + '/issue-434.md').toString();
  const markdown = await transformOdt('issue-434');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./issue-434-2', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/434
  const testMarkdown = fs.readFileSync(__dirname + '/issue-434-2.md').toString();
  const markdown = await transformOdt('issue-434-2');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'issue-434-2.md'));
});

Deno.test('test ./issue-435-436', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/435
  // https://github.com/mieweb/wikiGDrive/issues/436
  const testMarkdown = fs.readFileSync(__dirname + '/issue-435-436.md').toString();
  const markdown = await transformOdt('issue-435-436');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'issue-435-436.md'));
});

Deno.test('test ./issue-443', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/443
  const testMarkdown = fs.readFileSync(__dirname + '/issue-443.md').toString();
  const markdown = await transformOdt('issue-443');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'issue-443.md'));
});

Deno.test('test ./our-docs', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/443
  const testMarkdown = fs.readFileSync(__dirname + '/our-docs.md').toString();
  const markdown = await transformOdt('our-docs');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'our-docs.md'));
});

Deno.test('test ./header-link', async () => {
  // https://github.com/mieweb/wikiGDrive/issues/443
  const testMarkdown = fs.readFileSync(__dirname + '/header-link.md').toString();
  const markdown = await transformOdt('header-link');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false, 'header-link.md'));
});

async function transformOdt(id: string) {
  const folder = new FileContentService(__dirname);
  const odtPath = folder.getRealPath() + '/' + id + '.odt';
  const processor = new OdtProcessor();
  await processor.load(odtPath);
  if (!processor.getContentXml()) {
    throw Error('No odt processed');
  }
  return transform(processor.getContentXml(), processor.getStylesXml());
}

async function transform(contentXml: string, stylesXml: string) {
  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document: DocumentContent = parser.unmarshal(contentXml);
  if (!document) {
    throw Error('No document unmarshalled');
  }
  const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
  const styles: DocumentStyles = parserStyles.unmarshal(stylesXml);
  if (!styles) {
    throw Error('No styles unmarshalled');
  }
  const converter = new OdtToMarkdown(document, styles);
  return await converter.convert();
}
