import fs from 'node:fs';

import {compareTexts} from '../utils.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';
import {FileContentService} from '../../src/utils/FileContentService.ts';

import test from '../tester.ts';

const __dirname = import.meta.dirname;

test('test ./nested-ordered-list.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/nested-ordered-list.md').toString();
  const markdown = await transformOdt('nested-ordered-list');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./bullets.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/bullets.md').toString();
  const markdown = await transformOdt('bullets');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./quotes.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/quotes.md').toString();
  const markdown = await transformOdt('quotes');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./curly-braces.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/curly-braces.md').toString();
  const markdown = await transformOdt('curly-braces');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./confluence.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/confluence.md').toString();
  const markdown = await transformOdt('confluence');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./project-overview.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/project-overview.md').toString();
  const markdown = await transformOdt('project-overview');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./intro-to-the-system.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/intro-to-the-system.md').toString();
  const markdown = await transformOdt('intro-to-the-system');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./list-test.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/list-test.md').toString();
  const markdown = await transformOdt('list-test');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./list-indent.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/list-indent.md').toString();
  const markdown = await transformOdt('list-indent');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./strong-headers.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/strong-headers.md').toString();
  const markdown = await transformOdt('strong-headers');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./embedded-diagram-example.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/embedded-diagram-example.md').toString();
  const markdown = await transformOdt('embedded-diagram-example');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./suggest.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/suggest.md').toString();
  const markdown = await transformOdt('suggest');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./raw-html.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/raw-html.md').toString();
  const markdown = await transformOdt('raw-html');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./pre-mie.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/pre-mie.md').toString();
  const markdown = await transformOdt('pre-mie');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./block-macro.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/block-macro.md').toString();
  const markdown = await transformOdt('block-macro');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./example-document.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/example-document.md').toString();
  const markdown = await transformOdt('example-document');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./td-bullets.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/td-bullets.md').toString();
  const markdown = await transformOdt('td-bullets');
  t.true(compareTexts(testMarkdown, markdown));
});

test('test ./line-breaks.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/line-breaks.md').toString();
  const markdown = await transformOdt('line-breaks');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./code-links.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/code-links.md').toString();
  const markdown = await transformOdt('code-links');
  t.true(compareTexts(testMarkdown, markdown, false));
});

test('test ./code-blocks.md', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/code-blocks.md').toString();
  const markdown = await transformOdt('code-blocks');
  t.true(compareTexts(testMarkdown, markdown, false));
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
