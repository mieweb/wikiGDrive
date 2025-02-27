import {assertStrictEquals} from 'asserts';

import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {OdtProcessor} from '../../src/odt/OdtProcessor.ts';
import {FileContentService} from '../../src/utils/FileContentService.ts';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown.ts';

const __dirname = import.meta.dirname;

Deno.test('test content.xml transform to object', async () => {
  const fileSystem = new FileContentService(__dirname);
  const odtPath = fileSystem.getRealPath() + '/' + 'example_document.odt';
  const processor = new OdtProcessor();
  await processor.load(odtPath);

  const content = processor.getContentXml();

  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document = parser.unmarshal(content);

  // console.log(JSON.stringify(document, null, 2));

  const converter = new OdtToMarkdown(document, new DocumentStyles(), processor.getFileNameMap(), processor.getXmlMap());
  const md = await converter.convert();
  assertStrictEquals(true, !!md);
});
