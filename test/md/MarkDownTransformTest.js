/* eslint-disable @typescript-eslint/no-var-requires */

import {assert} from 'chai';
import {Readable, Writable} from 'stream';

import {MarkDownTransform} from '../../src/markdown/MarkDownTransform';
import {JsonToMarkdown} from '../../src/markdown/JsonToMarkdown';
import {compareTexts} from '../utils';

describe('MarkDownTransformTest', () => {

  it('test ./raw-html.md.markdown', async () => {

    const doc = require('./raw-html.md.json');
    const testMarkdown = require('!!raw-loader!./raw-html.md').default;

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

    const doc = require('./block-macro.md.json');
    const testMarkdown = require('!!raw-loader!./block-macro.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./bullets.md.markdown', async () => {

    const doc = require('./bullets.md.json');
    const testMarkdown = require('!!raw-loader!./bullets.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./quotes.md.markdown', async () => {

    const doc = require('./quotes.md.json');
    const testMarkdown = require('!!raw-loader!./quotes.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./curly-braces.md.markdown', async () => {

    const doc = require('./curly-braces.md.json');
    const testMarkdown = require('!!raw-loader!./curly-braces.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./test-page.md.markdown', async () => {

    const doc = require('./test-page.md.json');
    const testMarkdown = require('!!raw-loader!./test-page.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./confluence.md.markdown', async () => {

    const doc = require('./confluence.md.json');
    const testMarkdown = require('!!raw-loader!./confluence.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./project-overview.md.markdown', async () => {

    const doc = require('./project-overview.md.json');
    const testMarkdown = require('!!raw-loader!./project-overview.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./example-document.md.markdown', async () => {

    const doc = require('./example-document.md.json');
    const testMarkdown = require('!!raw-loader!./example-document.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./intro-to-the-system.md.markdown', async () => {

    const doc = require('./intro-to-the-system.md.json');
    const testMarkdown = require('!!raw-loader!./intro-to-the-system.md').default;

    const markdown = await transform(doc);

    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

});

async function transform(doc) {

  const linkTranslator = {
    async imageUrlToLocalPath(url) {
      return url;
    },
    convertToRelativeMarkDownPath(localPath) {
      return localPath;
    },
    urlToDestUrl(url) {
      return url;
    }
  };

  const markDownTransform = new MarkDownTransform('test.md', linkTranslator);

  let markdown = '';

  await new Promise((resolve, reject) => {

    const readable = new Readable();
    const writable = new Writable({
      write: function(chunk, encoding, next) {
        markdown += chunk.toString();
        next();
      }
    });

    readable
      .pipe(markDownTransform)
      .pipe(writable)
      .on('finish', () => {
        resolve();
      })
      .on('error', err => {
        reject(err);
      });

    readable.push(JSON.stringify(doc, null, 2));
    readable.push(null);
  });

  return markdown;
}

