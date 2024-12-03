import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import * as htmlparser2 from 'htmlparser2';
import * as domutils from 'domutils';
import {render} from 'dom-serializer';
import {Element} from 'domhandler';

import {markdownToHtml} from '../../src/google/markdownToHtml.ts';
import {convertToAbsolutePath} from '../../src/LinkTranslator.ts';
import {compareTexts} from '../utils.ts';

import test from '../tester.ts';

const __dirname = import.meta.dirname;

async function transformMd(id: string) {
  const markdownBuffer = fs.readFileSync(path.join(__dirname, id + '.md'));
  return await markdownToHtml(markdownBuffer);
}

test('test markdownToHtml links', async (t) => {
  const markdownBuffer = fs.readFileSync(path.join(__dirname, 'links.md'));
  const html = await markdownToHtml(markdownBuffer);

  const dom = htmlparser2.parseDocument(html);

  const map = {};

  const links = domutils.findAll((elem: Element) => {
    return ['a'].includes(elem.tagName) && !!elem.attribs?.href;
  }, dom.childNodes);
  const images = domutils.findAll((elem: Element) => {
    return ['img'].includes(elem.tagName) && !!elem.attribs?.src;
  }, dom.childNodes);

  for (const elem of links) {
    map[elem.attribs.href] = convertToAbsolutePath('/aaa/bbb/ccc.odt', elem.attribs.href);
  }
  for (const elem of images) {
    map[elem.attribs.src] = convertToAbsolutePath('/aaa/bbb/ccc.odt', elem.attribs.src);
  }

  t.is(map['./doc1.svg'], '/aaa/bbb/doc1.svg');
  t.is(map['doc2.svg'], '/aaa/bbb/doc2.svg');
  t.is(map['../subdir/diagram.svg'], '/aaa/subdir/diagram.svg');

  const serilzd = render(dom);
  t.true(!!serilzd);
});

test('test markdownToHtml pre', async (t) => {
  const markdownBuffer = fs.readFileSync(path.join(__dirname, 'links.md'));
  const markdown = new TextDecoder().decode(markdownBuffer);
  const input = Buffer.from(new TextEncoder().encode(markdown));
  const html = await markdownToHtml(input);

  const dom = htmlparser2.parseDocument(html);

  const serilzd = render(dom);
  t.true(!!serilzd);
});

test('test markdownToHtml link_to_image', async (t) => {
  const markdownBuffer = fs.readFileSync(path.join(__dirname, 'link_to_image.md'));
  const markdown = new TextDecoder().decode(markdownBuffer);
  const input = Buffer.from(new TextEncoder().encode(markdown));
  const html = await markdownToHtml(input);

  const dom = htmlparser2.parseDocument(html);

  const serilzd = render(dom);
  console.log(serilzd);
  t.true(!!serilzd);
});

test('test ./paras', async (t) => {
  const testHtml = fs.readFileSync(__dirname + '/paras.html').toString();
  const markdown = await transformMd('paras');
  t.true(compareTexts(testHtml, markdown));
});

test('test ./header_links', async (t) => {
  const testHtml = fs.readFileSync(__dirname + '/header_links.html').toString();
  const markdown = await transformMd('header_links');
  t.true(compareTexts(testHtml, markdown));
});
