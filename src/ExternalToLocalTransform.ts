import {Transform} from 'stream';
import {FileMap, GoogleFiles} from "./storage/GoogleFiles";
import {ExternalFiles, LinkEntry} from "./storage/ExternalFiles";

async function processRecursive(json, func) {
  if (Array.isArray(json)) {
    for (const item of json) {
      await processRecursive(item, func);
    }
  } else
  if (typeof json === 'object') {
    for (let k in json) {
      await processRecursive(json[k], func);
    }
    await func(json);
  }
}

async function convertImageLink(document, url) {
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

export class ExternalToLocalTransform extends Transform {
  private fileMap: FileMap;
  private json: string;

  constructor(private googleFiles: GoogleFiles, private externalFiles: ExternalFiles) {
    super();

    this.fileMap = this.googleFiles.getFileMap();
    this.json = '';
  }

  _transform(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = chunk.toString();
    }

    this.json += chunk;

    callback();
  }

  async _flush(callback) {
    const document = JSON.parse(this.json);

    await processRecursive(document.body.content, async (json) => {
      if (json.inlineObjectElement) {
        let url = await convertImageLink(document, json.inlineObjectElement.inlineObjectId);
        if (url.endsWith('.md5')) {
          const md5Checksum = url.replace('.md5', '');
          const externalFile = this.externalFiles.findFile(file => file.md5Checksum === md5Checksum);
          if (externalFile) {
            url = externalFile.localDocumentPath || externalFile.localPath;
          }
        }

        for (let fileId in this.fileMap) {
          const file = this.fileMap[fileId];

          if (url.indexOf(fileId) > -1 && url.indexOf('parent=' + fileId) === -1) {
            url = file.localPath;
            return url;
          }
        }

        if (url.startsWith('https:') || url.startsWith('http:')) {
          const link: LinkEntry = this.externalFiles.findLink(link => link.url === url);
          if (link && link.md5Checksum) {

            const file = this.googleFiles.findFile(file => file.md5Checksum === link.md5Checksum);
            if (file) {
              url = file.localPath;
            } else {
              const externalFile = this.externalFiles.findFile(file => file.md5Checksum === link.md5Checksum);
              if (externalFile) {
                url = externalFile.localDocumentPath || externalFile.localPath;
              }
            }
          }
        }

        json.inlineObjectElement.inlineObjectId = url;
      }
    });

    this.push(JSON.stringify(document, null, 4));

    callback();
  }

}
