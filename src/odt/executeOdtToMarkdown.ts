import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

import {OdtToMarkdown} from './OdtToMarkdown.ts';
import {UnMarshaller} from './UnMarshaller.ts';
import {DocumentStyles, LIBREOFFICE_CLASSES} from './LibreOffice.ts';
import {generateDocumentFrontMatter} from '../containers/transform/frontmatters/generateDocumentFrontMatter.ts';
import {OdtProcessor} from './OdtProcessor.ts';

export async function executeOdtToMarkdown(workerData) {
  const processor = new OdtProcessor(true);
  await processor.load(workerData.odtPath);
  await processor.unzipAssets(workerData.destinationPath, workerData.realFileName);
  const content = processor.getContentXml();
  const stylesXml = processor.getStylesXml();
  const fileNameMap = processor.getFileNameMap();
  const xmlMap = processor.getXmlMap();

  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document = parser.unmarshal(content);

  const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
  const styles: DocumentStyles = parserStyles.unmarshal(stylesXml);
  if (!styles) {
    throw Error('No styles unmarshalled');
  }

  const converter = new OdtToMarkdown(document, styles, fileNameMap, xmlMap);
  converter.setRewriteRules(workerData.rewriteRules);
  if (workerData.realFileName === '_index.md') {
    converter.setPicturesDir('./' + workerData.realFileName.replace(/.md$/, '.assets/'), workerData.picturesDirAbsolute);
  } else {
    converter.setPicturesDir('../' + workerData.realFileName.replace(/.md$/, '.assets/'), workerData.picturesDirAbsolute);
  }
  const markdown = await converter.convert();
  const links = Array.from(converter.links);

  const frontMatterOverload: Record<string, string> = {};
  if (markdown.indexOf(' A.  ') > -1 || markdown.indexOf(' a.  ') > -1) {
    frontMatterOverload['markup'] = 'pandoc';
  }

  const frontMatter = generateDocumentFrontMatter(workerData.localFile, links, workerData.fm_without_version, frontMatterOverload);
  const errors = converter.getErrors();

  if (process.env.VERSION === 'dev') {
    fs.writeFileSync(path.join(workerData.destinationPath, workerData.realFileName.replace(/.md$/, '.debug.xml')), content);
  }

  const headersMap = converter.getHeadersMap();
  const invisibleBookmarks = converter.getInvisibleBookmarks();

  return { links, frontMatter, markdown, errors, headersMap, invisibleBookmarks };
}
