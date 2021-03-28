import {DownloadFileImages} from '../storage/DownloadFilesStorage';

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

export async function extractDocumentImages(document: any): Promise<DownloadFileImages> {
  const links = {};
  await processRecursive(document.body.content, async (json) => {
    if (json.inlineObjectElement) {
      const url = json.inlineObjectElement.inlineObjectId;
      links[url] = await convertImageLink(document, url);
    }
  });

  return links;
}
