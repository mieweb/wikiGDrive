import {DownloadFile, DownloadFileImage} from '../storage/DownloadFilesStorage';
import {getImageDistance} from '../utils/getImageMeta';

const TOLERANCE = 5;

interface ContentRow {
  paragraph: {
    elements: ContentRow[];
  };
  inlineObjectElement: {
    src: string;
    inlineObjectId: string;
  };
}

export class EmbedImageFixer {
  private readonly images: DownloadFileImage[];
  private diagrams: DownloadFile[];

  constructor(images: DownloadFileImage[], private imagesDirPath: string) {
    this.images = images;
  }

  private async fixUrl(image: DownloadFileImage) {
    if (image.fileId) {
      // const localFile = await this.localFilesStorage.findFile(file => file.id === image.fileId);
      // if (localFile) {
      //   return localFile.localPath;
      // }
    }

    if (image.zipImage) {

      const distances = this.diagrams
        .map(diagram => {
          return {
            distance: getImageDistance(diagram.image.hash, image.zipImage.hash),
            diagram: diagram
          };
        })
        .filter(item => item.distance < TOLERANCE)
        .sort((a, b) => a.distance - b.distance);

      if (distances.length > 0) {
        // const localFile = await this.localFilesStorage.findFile(file => file.id === distances[0].diagram.id);
        // if (localFile) {
        //   return localFile.localPath;
        // }
      }

      return this.imagesDirPath + '' + image.zipImage.zipPath;
    }

    return image.pngUrl;
  }

  async fixEmbedImages(content: ContentRow[], inlineObjects: {[key: string]: string}, currentNo = 0) {
    for (const item of content) {
      if (item.inlineObjectElement && item.inlineObjectElement.inlineObjectId) {
        const image: DownloadFileImage = this.images[currentNo];
        item.inlineObjectElement.src = await this.fixUrl(image);

        currentNo++;
      }

      if (item.paragraph && item.paragraph.elements) {
        currentNo = await this.fixEmbedImages(item.paragraph.elements, inlineObjects, currentNo);
      }
    }

    return currentNo;
  }

  async process(document) {
    // this.diagrams = await this.downloadFilesStorage.findFiles(file => file.mimeType === MimeTypes.DRAWING_MIME);
    // await this.fixEmbedImages(document.body.content, document.inlineObjects);
    return document;
  }
}
