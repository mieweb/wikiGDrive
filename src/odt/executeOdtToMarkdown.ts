import {OdtToMarkdown} from './OdtToMarkdown';
import {UnMarshaller} from './UnMarshaller';
import {DocumentStyles, LIBREOFFICE_CLASSES} from './LibreOffice';
import {generateDocumentFrontMatter} from '../containers/transform/frontmatters/generateDocumentFrontMatter';

export async function executeOdtToMarkdown(workerData) {
  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document = parser.unmarshal(workerData.content);

  const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
  const styles: DocumentStyles = parserStyles.unmarshal(workerData.stylesXml);
  if (!styles) {
    throw Error('No styles unmarshalled');
  }

  const converter = new OdtToMarkdown(document, styles);
  if (workerData.realFileName === '_index.md') {
    converter.setPicturesDir('./' + workerData.realFileName.replace('.md', '.assets/'));
  } else {
    converter.setPicturesDir('../' + workerData.realFileName.replace('.md', '.assets/'));
  }
  const markdown = await converter.convert();
  const links = Array.from(converter.links);

  const frontMatter = generateDocumentFrontMatter(workerData.localFile, workerData.hierarchy, links, workerData.fm_without_version);
  return { links, frontMatter, markdown };
}
