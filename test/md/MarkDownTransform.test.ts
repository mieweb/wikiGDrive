import {assert} from 'chai';
import * as fs from 'fs';

import {compareTexts} from '../utils';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown';
import {DocumentContent, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice';
import {UnMarshaller} from '../../src/odt/UnMarshaller';
import {OdtProcessor} from '../../src/odt/OdtProcessor';
import {FileContentService} from '../../src/utils/FileContentService';

describe('MarkDownTransformTest', () => {

  it('test ./raw-html.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/raw-html.md').toString();
    const markdown = await transformOdt('raw-html');
    assert.ok(compareTexts(testMarkdown, markdown));
  });

  it('test ./block-macro.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/block-macro.md').toString();
    const markdown = await transformOdt('block-macro');
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

  it('test ./project-overview.md.markdown', async () => {
    const testMarkdown = fs.readFileSync(__dirname + '/project-overview.md').toString();
    const markdown = await transformOdt('project-overview');
    console.log(markdown);
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

});

async function transformOdt(id: string) {
  const folder = new FileContentService(__dirname);
  const processor = new OdtProcessor(folder, id);
  await processor.load();
  if (!processor.getContentXml()) {
    throw Error('No odt processed');
  }
  return transform(processor.getContentXml());
}

async function transform(content: string) {
  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document: DocumentContent = parser.unmarshal(content);
  if (!document) {
    throw Error('No document unmarshalled');
  }
  const converter = new OdtToMarkdown(document);
  return await converter.convert();
}