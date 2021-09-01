import {DownloadFileImage} from '../storage/DownloadFilesStorage';
import {findAll} from 'domutils';
import {createDom} from '../html/GoogleListFixer';
import { urlToFolderId } from './idParsers';

export async function convertImageLink(document, url) {
  if (document.inlineObjects[url]) {
    const inlineObject = document.inlineObjects[url];

    const embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
    if (embeddedObject.imageProperties) {
      if (embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri) {
        url = embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri;
      } else {
        url = '';
      }
    }
  }

  if (!url) {
    return '';
  }

  return url;
}

export async function processRecursive(json, func) {
  if (Array.isArray(json)) {
    for (const item of json) {
      await processRecursive(item, func);
    }
  } else
  if (typeof json === 'object') {
    for (const k in json) {
      await processRecursive(json[k], func);
    }
    await func(json);
  }
}

export async function extractDocumentImages(document: any): Promise<DownloadFileImage[]> {
  const links: DownloadFileImage[] = [];
  await processRecursive(document.body.content, async (json) => {
    if (json.inlineObjectElement) {
      const docUrl = json.inlineObjectElement.inlineObjectId;

      const link: DownloadFileImage = {
        docUrl,
        pngUrl: await convertImageLink(document, docUrl)
      };

      const url = json.inlineObjectElement.textStyle?.link?.url;
      if (url && url.startsWith('https://docs.google.com/drawings/d/')) {
        link.fileId = urlToFolderId(url);
      }

      links.push(link);
    }
  });

  return links;
}

export async function extractHtmlImagesOrder(html) {
  const dom = await createDom(html);
  const elements = findAll((elem) => {
    return elem.name === 'img';
  }, dom);

  return elements.map(element => element.attribs['src']?.replace(/^images\//, ''));
}
