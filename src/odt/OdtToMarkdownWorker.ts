import { workerData, parentPort } from 'worker_threads';
import {OdtToMarkdown} from './OdtToMarkdown';

const converter = new OdtToMarkdown(workerData.document, workerData.styles);
converter.setPicturesDir('../' + workerData.realFileName.replace('.md', '.assets/'));
const markdown = await converter.convert();
const links = Array.from(converter.links);

parentPort.postMessage({ markdown, links });
