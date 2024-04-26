import fs from 'fs';
import path from 'path';

import {OdtToMarkdown} from './OdtToMarkdown.ts';
import {UnMarshaller} from './UnMarshaller.ts';
import {DocumentStyles, LIBREOFFICE_CLASSES} from './LibreOffice.ts';
import {generateDocumentFrontMatter} from '../containers/transform/frontmatters/generateDocumentFrontMatter.ts';
import {OdtProcessor} from './OdtProcessor.ts';

export async function executeOdtToMarkdown(workerData) {
  const processor = new OdtProcessor(workerData.odtPath, true);
  await processor.load();
  await processor.unzipAssets(workerData.destinationPath, workerData.realFileName);
  const content = processor.getContentXml();
  const stylesXml = processor.getStylesXml();
  const fileNameMap = processor.getFileNameMap();

  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document = parser.unmarshal(content);

  const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
  const styles: DocumentStyles = parserStyles.unmarshal(stylesXml);
  if (!styles) {
    throw Error('No styles unmarshalled');
  }

  const converter = new OdtToMarkdown(document, styles, fileNameMap);
  converter.setRewriteRules(workerData.rewriteRules);
  if (workerData.realFileName === '_index.md') {
    converter.setPicturesDir('./' + workerData.realFileName.replace(/.md$/, '.assets/'), workerData.picturesDirAbsolute);
  } else {
    converter.setPicturesDir('../' + workerData.realFileName.replace(/.md$/, '.assets/'), workerData.picturesDirAbsolute);
  }
  const markdown = await converter.convert();
  const links = Array.from(converter.links);

  const frontMatter = generateDocumentFrontMatter(workerData.localFile, links, workerData.fm_without_version);
  const errors = converter.getErrors();

  if (process.env.VERSION === 'dev') {
    fs.writeFileSync(path.join(workerData.destinationPath, workerData.realFileName.replace(/.md$/, '.debug.xml')), markdown);
  }

  return { links, frontMatter, markdown, errors };
}
