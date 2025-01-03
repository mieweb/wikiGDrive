import fs from 'node:fs';
import {compareTexts} from '../utils.ts';
import {FileContentService} from '../../src/utils/FileContentService.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';
import {RewriteRule} from '../../src/odt/applyRewriteRule.ts';

const __dirname = import.meta.dirname;

import test from '../tester.ts';

const RULES: RewriteRule[] = [
  {
    match: '(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:[^\\/\\n\\s]+\\/\\S+\\/|(?:v|e(?:mbed)?)\\/|\\S*?[?&]v=)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})',
    replace: '(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:[^\\/\\n\\s]+\\/\\S+\\/|(?:v|e(?:mbed)?)\\/|\\S*?[?&]v=)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})',
    template: '[$label](https://youtube.be/$value)'
  },
  {
    match: 'https://github.com/mieweb/docs_video/blob/main/',
    template: '[https://cloudflare.com/$basename](https://cloudflare.com/$basename)'
  },
  {
    match: '.png$',
    template: '<img src="$href" />'
  }
];

test('test ./rewrite-rules.md.markdown', async (t) => {
  const testMarkdown = fs.readFileSync(__dirname + '/rewrite-rules.md').toString();
  const markdown = await transformOdt('rewrite-rules');
  t.true(compareTexts(testMarkdown, markdown));
});

async function transformOdt(id: string) {
  const folder = new FileContentService(__dirname);
  const odtPath = folder.getRealPath() + '/' + id + '.odt';
  const processor = new OdtProcessor();
  await processor.load(odtPath);
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
  converter.setRewriteRules(RULES);
  return await converter.convert();
}
