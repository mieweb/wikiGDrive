import {assert} from 'chai';
import * as fs from 'fs';

import {JsonToMarkdown} from '../../src/markdown/JsonToMarkdown';
import {compareTexts} from '../utils';

describe('MarkDownTransformTest', () => {

  it('test ./raw-html.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/raw-html.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/raw-html.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test strong tags', async () => {
    const html = '<strong>test </strong>abc';
    const markdown = JsonToMarkdown.convertHtmlSimpleTags(html);

    assert.equal('**test** abc', markdown);

    return Promise.resolve();
  });

  it('test ./block-macro.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/block-macro.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/block-macro.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./bullets.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/bullets.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/bullets.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./quotes.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/quotes.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/quotes.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./curly-braces.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/curly-braces.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/curly-braces.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./test-page.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/test-page.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/test-page.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./confluence.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/confluence.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/confluence.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./project-overview.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/project-overview.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/project-overview.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./example-document.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/example-document.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/example-document.md').toString();

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./intro-to-the-system.md.markdown', async () => {

    const doc = JSON.parse(fs.readFileSync(__dirname + '/intro-to-the-system.md.json').toString());
    const testMarkdown = fs.readFileSync(__dirname + '/intro-to-the-system.md').toString();

    const markdown = await transform(doc);

    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

});

async function transform(doc) {
  const converter = new JsonToMarkdown(doc);
  return await converter.convert();
}
