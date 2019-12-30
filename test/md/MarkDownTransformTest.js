import { assert } from 'chai';
import {Readable, Writable} from 'stream';

import { MarkDownTransform } from '../../src/MarkDownTransform';
import {compareTexts} from '../utils';

describe('MarkDownTransformTest', () => {
  it('test ./curly-braces.md.json', async () => {

    const doc = require('./curly-braces.md.json');
    const testMarkdown = require('!!raw-loader!./curly-braces.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./test-page.md.json', async () => {

    const doc = require('./test-page.md.json');
    const testMarkdown = require('!!raw-loader!./test-page.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./confluence.md.json', async () => {

    const doc = require('./confluence.md.json');
    const testMarkdown = require('!!raw-loader!./confluence.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./project-overview.md.json', async () => {

    const doc = require('./project-overview.md.json');
    const testMarkdown = require('!!raw-loader!./project-overview.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./example-document.md.json', async () => {

    const doc = require('./example-document.md.json');
    const testMarkdown = require('!!raw-loader!./example-document.md').default;

    const markdown = await transform(doc);
    assert.ok(compareTexts(testMarkdown, markdown));

    return Promise.resolve();
  });

  it('test ./intro-to-the-system.md.json', async () => {

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
    convertToRelativeMarkDownPath(basePath, localPath) {
      return localPath;
    },
    urlToDestUrl(url) {
      return url;
    }
  };

  const markDownTransform = new MarkDownTransform('test.md', linkTranslator);

  let markdown = '';

  await new Promise(((resolve, reject) => {

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
  }));

  return markdown;
}

