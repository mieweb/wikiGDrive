'use strict';

import path from 'path';
import minimist from 'minimist';
import {fileURLToPath} from 'url';
import {Buffer} from 'buffer';
import fs from 'fs';

import {OdtProcessor} from '../odt/OdtProcessor.ts';
import {UnMarshaller} from '../odt/UnMarshaller.ts';
import {DocumentContent, DocumentStyles, LIBREOFFICE_CLASSES} from '../odt/LibreOffice.ts';
import {OdtToMarkdown} from '../odt/OdtToMarkdown.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.GIT_SHA = process.env.GIT_SHA || 'dev';

async function usage() {
  const pkg = JSON.parse(new TextDecoder().decode(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))));

  const commandUsage = 'echo "test" | odt2md\n\nor\n\nodt2md filename.odt';

  console.log(
    `${pkg.name} version: ${pkg.version}, ${process.env.GIT_SHA}\n\nUsage:\n${commandUsage.trim()}\n`);
}

async function main() {
  const inputArr = [];

  process.stdin.on( 'data', function(data) { inputArr.push(data); } );

  await new Promise(resolve => {
    setTimeout(() => {
      process.stdin.destroy();
      resolve(null);
    }, 50);
    process.stdin.on( 'end', resolve);
  });

  const argv = minimist(process.argv.slice(2));

  if (inputArr.length === 0) {
    if (argv._.length < 1 || argv.h || argv.help) {
      await usage();
      process.exit(1);
    }

    inputArr.push(fs.readFileSync(path.resolve(process.cwd(), argv._[0])));
  }

  if (inputArr.length === 0) {
    console.error('No input');
    process.exit(1);
  }

  const processor = new OdtProcessor();
  await processor.loadFromBuffer(Buffer.concat(inputArr));
  if (!processor.getContentXml()) {
    throw Error('No odt processed');
  }

  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const document: DocumentContent = parser.unmarshal(processor.getContentXml());
  if (!document) {
    throw Error('No document unmarshalled');
  }
  const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
  const styles: DocumentStyles = parserStyles.unmarshal(processor.getStylesXml());
  if (!styles) {
    throw Error('No styles unmarshalled');
  }
  const converter = new OdtToMarkdown(document, styles, processor.getFileNameMap(), processor.getXmlMap());
  const markdown = await converter.convert();
  console.log(markdown);
}

try {
  await main();
  process.exit(0);
} catch (err) {
  if (err.isUsageError) {
    console.error(err.message);
    await usage();
  } else {
    console.error(err);
  }
  process.exit(1);
}
