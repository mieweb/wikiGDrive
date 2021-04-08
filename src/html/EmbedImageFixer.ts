import {docs_v1} from 'googleapis';
import Schema$Document = docs_v1.Schema$Document;
import {DownloadFileImage} from '../storage/DownloadFilesStorage';

export class EmbedImageFixer {
  private readonly images: any[];

  constructor(images: DownloadFileImage[], private imagesDirPath: string) {
    this.images = images;
  }

  private fixUrl(image: DownloadFileImage) {
    if (image.zipImage) {
      return this.imagesDirPath + '' + image.zipImage.zipPath;
    }

    return image.pngUrl;
  }

  private fixEmbedImages(content: any, inlineObjects: {[key: string]: any}, currentNo = 0) {
    for (const item of content) {
      if (item.inlineObjectElement && item.inlineObjectElement.inlineObjectId) {
        const id = item.inlineObjectElement.inlineObjectId;

        // if (inlineObjects[id]) {
          const embeddedObject = inlineObjects[id].inlineObjectProperties.embeddedObject;
          const image: DownloadFileImage = this.images[currentNo];
          const src = this.fixUrl(image);

          item.inlineObjectElement.src = src;

          // embeddedObject.imageProperties = {
          //   contentUri: src
          // };
        // }

        currentNo++;
      }

      if (item.paragraph && item.paragraph.elements) {
        currentNo = this.fixEmbedImages(item.paragraph.elements, inlineObjects, currentNo);
      }
    }

    return currentNo;
  }

  async process(document: Schema$Document) {
    this.fixEmbedImages(document.body.content, document.inlineObjects);
    return document;
  }
}
