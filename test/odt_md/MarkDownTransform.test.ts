import fs from 'node:fs';
// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import {compareTexts} from '../utils.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';
import {FileContentService} from '../../src/utils/FileContentService.ts';

const __dirname = import.meta.dirname;

Deno.test('test ./nested-ordered-list.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/nested-ordered-list.md').toString();
  const markdown = await transformOdt('nested-ordered-list');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./bullets.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/bullets.md').toString();
  const markdown = await transformOdt('bullets');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./quotes.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/quotes.md').toString();
  const markdown = await transformOdt('quotes');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./curly-braces.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/curly-braces.md').toString();
  const markdown = await transformOdt('curly-braces');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./confluence.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/confluence.md').toString();
  const markdown = await transformOdt('confluence');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./project-overview.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/project-overview.md').toString();
  const markdown = await transformOdt('project-overview');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./intro-to-the-system.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/intro-to-the-system.md').toString();
  const markdown = await transformOdt('intro-to-the-system');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./list-test.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/list-test.md').toString();
  const markdown = await transformOdt('list-test');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./lettered-list.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/lettered-list.md').toString();
  const markdown = await transformOdt('lettered-list');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./list-indent.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/list-indent.md').toString();
  const markdown = await transformOdt('list-indent');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./strong-headers.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/strong-headers.md').toString();
  const markdown = await transformOdt('strong-headers');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./embedded-diagram-example.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/embedded-diagram-example.md').toString();
  const markdown = await transformOdt('embedded-diagram-example');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./suggest.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/suggest.md').toString();
  const markdown = await transformOdt('suggest');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./raw-html.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/raw-html.md').toString();
  const markdown = await transformOdt('raw-html');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./pre-mie.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/pre-mie.md').toString();
  const markdown = await transformOdt('pre-mie');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./block-macro.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/block-macro.md').toString();
  const markdown = await transformOdt('block-macro');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./example-document.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/example-document.md').toString();
  const markdown = await transformOdt('example-document');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./td-bullets.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/td-bullets.md').toString();
  const markdown = await transformOdt('td-bullets');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown));
});

Deno.test('test ./line-breaks.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/line-breaks.md').toString();
  const markdown = await transformOdt('line-breaks');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./code-links.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/code-links.md').toString();
  const markdown = await transformOdt('code-links');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

Deno.test('test ./code-blocks.md', async () => {
  const testMarkdown = fs.readFileSync(__dirname + '/code-blocks.md').toString();
  const markdown = await transformOdt('code-blocks');
  assertStrictEquals(true, compareTexts(testMarkdown, markdown, false));
});

async function transformOdt(id: string) {
  const folder = new FileContentService(__dirname);
  const odtPath = folder.getRealPath() + '/' + id + '.odt';
  const processor = new OdtProcessor();
  await processor.load(odtPath);
  if (!processor.getContentXml()) {
    throw Error('No odt processed');
  }
  return await transform(processor.getContentXml(), processor.getStylesXml(), processor);
}

async function transform(contentXml: string, stylesXml: string, processor: OdtProcessor) {
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
  const converter = new OdtToMarkdown(document, styles, processor.getFileNameMap(), processor.getXmlMap());
  return await converter.convert();
}
