import {assert} from 'chai';
import fs from 'fs';

import {compareTexts} from '../utils.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';
import {FileContentService} from '../../src/utils/FileContentService.ts';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MarkDownTransformTest', () => {

  it('test ./raw-html.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/raw-html.md').toString();
    const markdown = await transformOdt('raw-html');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./bullets.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/bullets.md').toString();
    const markdown = await transformOdt('bullets');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./quotes.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/quotes.md').toString();
    const markdown = await transformOdt('quotes');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./curly-braces.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/curly-braces.md').toString();
    const markdown = await transformOdt('curly-braces');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./confluence.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/confluence.md').toString();
    const markdown = await transformOdt('confluence');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./block-macro.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/block-macro.md').toString();
    const markdown = await transformOdt('block-macro');
    // console.log(markdown);
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./project-overview.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/project-overview.md').toString();
    const markdown = await transformOdt('project-overview');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./example-document.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/example-document.md').toString();
    const markdown = await transformOdt('example-document');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./intro-to-the-system.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/intro-to-the-system.md').toString();
    const markdown = await transformOdt('intro-to-the-system');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./list-test.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/list-test.md').toString();
    const markdown = await transformOdt('list-test');
    assert.ok(compareTexts(testMarkdown, markdown, false));
  });

  it('test ./list-indent.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/list-indent.md').toString();
    const markdown = await transformOdt('list-indent');
    assert.ok(compareTexts(testMarkdown, markdown, false));
  });

  it('test ./strong-headers.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/strong-headers.md').toString();
    const markdown = await transformOdt('strong-headers');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./embedded-diagram-example', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/embedded-diagram-example.md').toString();
    const markdown = await transformOdt('embedded-diagram-example');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./suggest', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/suggest.md').toString();
    const markdown = await transformOdt('suggest');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./pre-mie', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/pre-mie.md').toString();
    const markdown = await transformOdt('pre-mie');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./td-bullets', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/td-bullets.md').toString();
    const markdown = await transformOdt('td-bullets');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./line-breaks', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/line-breaks.md').toString();
    const markdown = await transformOdt('line-breaks');
    assert.ok(compareTexts(testMarkdown, markdown, false));
  });

  it('test ./code-links', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/code-links.md').toString();
    const markdown = await transformOdt('code-links');
    assert.ok(compareTexts(testMarkdown, markdown, false));
  });

});

async function transformOdt(id: string) {
  const folder = new FileContentService(__dirname);
  const odtPath = folder.getRealPath() + '/' + id + '.odt';
  const processor = new OdtProcessor(odtPath);
  await processor.load();
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
