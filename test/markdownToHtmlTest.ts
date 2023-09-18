import {assert} from 'chai';
import htmlparser2 from 'htmlparser2';
import render from 'dom-serializer';
import domutils from 'domutils';
import {Element} from 'domhandler';

import {markdownToHtml} from '../src/google/markdownToHtml';
import {convertToAbsolutePath} from '../src/LinkTranslator';

describe('markdownToHtml', () => {
  it('test markdownToHtml links', async () => {
    const markdown = '# Header\n\n![Diagram](../subdir/Diagram.svg)\n[Doc1](./Doc1.svg)\n[Doc2](Doc2.svg)\n';
    const input = Buffer.from(new TextEncoder().encode(markdown));
    const html = await markdownToHtml(input);

    const dom = htmlparser2.parseDocument(html);

    const map = {};

    const links = domutils.findAll((elem: Element) => {
      return ['a'].includes(elem.tagName) && !!elem.attribs?.href;
    }, dom.childNodes);
    const images = domutils.findAll((elem: Element) => {
      return ['img'].includes(elem.tagName) && !!elem.attribs?.src;
    }, dom.childNodes);

    for (const elem of links) {
      map[elem.attribs.href] = convertToAbsolutePath('/aaa/bbb/ccc.md', elem.attribs.href);
    }
    for (const elem of images) {
      map[elem.attribs.src] = convertToAbsolutePath('/aaa/bbb/ccc.md', elem.attribs.src);
    }

    assert.equal(map['./Doc1.svg'], '/aaa/bbb/Doc1.svg');
    assert.equal(map['Doc2.svg'], '/aaa/bbb/Doc2.svg');
    assert.equal(map['../subdir/Diagram.svgg'], '/aaa/subdir/Diagram.svg');

    const serilzd = render(dom);
    console.log(serilzd);
  });
});
