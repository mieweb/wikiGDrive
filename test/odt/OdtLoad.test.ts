import {UnMarshaller} from '../../src/odt/UnMarshaller';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice';
import {OdtProcessor} from '../../src/odt/OdtProcessor';
import {FileContentService} from '../../src/utils/FileContentService';
import {OdtToMarkdown} from '../../src/odt/OdtToMarkdown';
import {assert} from 'chai';

describe('OdtLoad', () => {
  it('test content.xml transform to object', async () => {
    const fileSystem = new FileContentService(__dirname);
    const processor = new OdtProcessor(fileSystem, 'example_document');
    await processor.load();

    const content = processor.getContentXml();

    const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
    const document = parser.unmarshal(content);

    // console.log(JSON.stringify(document, null, 2));

    const converter = new OdtToMarkdown(document, new DocumentStyles());
    const md = await converter.convert();
    assert.ok(md);
  });
});
