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

  it('test ./issue-431', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/431
    const testMarkdown = fs.readFileSync(__dirname + '/issue-431.md').toString();
    const markdown = await transformOdt('issue-431');
    assert.ok(compareTexts(testMarkdown, markdown, false, 'issue-431.md'));
  });

  it('test ./issue-432', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/432
    const testMarkdown = fs.readFileSync(__dirname + '/issue-432.md').toString();
    const markdown = await transformOdt('issue-432');
    assert.ok(compareTexts(testMarkdown, markdown, false, 'issue-432.md'));
  });

  it('test ./issue-434', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/434
    const testMarkdown = fs.readFileSync(__dirname + '/issue-434.md').toString();
    const markdown = await transformOdt('issue-434');
    assert.ok(compareTexts(testMarkdown, markdown, false));
  });

  it('test ./issue-434-2', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/434
    const testMarkdown = fs.readFileSync(__dirname + '/issue-434-2.md').toString();
    const markdown = await transformOdt('issue-434-2');
    assert.ok(compareTexts(testMarkdown, markdown, false, 'issue-434-2.md'));
  });

  it('test ./issue-435-436', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/435
    // https://github.com/mieweb/wikiGDrive/issues/436
    const testMarkdown = fs.readFileSync(__dirname + '/issue-435-436.md').toString();
    const markdown = await transformOdt('issue-435-436');
    assert.ok(compareTexts(testMarkdown, markdown, false, 'issue-435-436.md'));
  });

  it('test ./issue-443', async () => {
    // https://github.com/mieweb/wikiGDrive/issues/443
    const testMarkdown = fs.readFileSync(__dirname + '/issue-443.md').toString();
    const markdown = await transformOdt('issue-443');
    assert.ok(compareTexts(testMarkdown, markdown, false, 'issue-443.md'));
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
