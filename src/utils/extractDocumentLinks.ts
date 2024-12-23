import {DownloadFileImage} from '../storage/DownloadFilesStorage.ts';
import { urlToFolderId } from './idParsers.ts';
import {xml2js} from 'xml-js';

export function traverseObject(obj: string|object|string[]|object[], func: (obj: string|object|string[]|object[], path: string) => boolean, path = '') {
  if (!obj) {
    return obj;
  }
  if (func(obj, path) === false) {
    return;
  }
  if (Array.isArray(obj)) {
    for (let idx = 0; idx < obj.length; idx++) {
      const subPath = path + '[' + idx + ']';
      obj[idx] = traverseObject(obj[idx], func, subPath);
    }
    return obj;
  }
  if (typeof obj === 'object') {
    for (const k in obj) {
      const subPath = path ? path + '.' + k : k;
      obj[k] = traverseObject(obj[k], func, subPath);
    }
  }
  return obj;
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function extractXmlImagesOrder(xml) {
  const oodoc = xml2js(xml, { alwaysArray: true });

  const elements = [];
  traverseObject(oodoc, (obj) => {
    if (typeof obj === 'object') {
      if ('draw:image' === obj['name'] && obj['attributes'] && obj['attributes']['xlink:href']) {
        elements.push(obj);
      }
    }
    return true;
  });

  return elements.map(element => element.attributes['xlink:href']?.replace(/^Pictures\//, ''));
}
