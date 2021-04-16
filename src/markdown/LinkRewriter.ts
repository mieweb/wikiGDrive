import {docs_v1} from 'googleapis';
import Schema$Document = docs_v1.Schema$Document;
import {LinkTranslator} from '../LinkTranslator';

export class LinkRewriter {

  constructor(private document: Schema$Document, private linkTranslator: LinkTranslator, private localPath: string) {
  }

  async convertImageLink(url) {
    if (this.document.inlineObjects[url]) {
      const inlineObject = this.document.inlineObjects[url];

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

    // const localPath = await this.linkTranslator.imageUrlToLocalPath(url);
    // return this.linkTranslator.convertToRelativeMarkDownPath(localPath, this.localPath);
    if (this.linkTranslator) {
      return this.linkTranslator.convertToRelativeMarkDownPath(url, this.localPath);
    } else {
      return this.localPath;
    }
  }

  async processElement(element) {
    if (Array.isArray(element)) {
      return this.processElements(element);
    }

    if ('object' !== typeof element) {
      return ;
    }

    if (element?.textRun?.textStyle?.link) {
      if (element.textRun.textStyle.link.url) {
        if (this.linkTranslator) {
          const localPath = await this.linkTranslator.urlToDestUrl(element.textRun.textStyle.link.url);
          const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(localPath, this.localPath);
          element.textRun.textStyle.link.url = relativePath;
        }
      }
    } else
    if (element.inlineObjectElement?.src) {
      element.inlineObjectElement.src = this.linkTranslator.convertToRelativeMarkDownPath(element.inlineObjectElement.src, this.localPath);
      // const imageLink = await this.convertImageLink(element.inlineObjectElement.inlineObjectId);
      // const localPath = await this.linkTranslator.imageUrlToLocalPath(element.inlineObjectElement.inlineObjectId);
      // const imageLink = localPath;
      // const imageLink = await this.linkTranslator.convertToRelativeMarkDownPath(localPath, this.localPath);
      // const imageLink = await this.convertImageLink(localPath);
      // element.inlineObjectElement = imageLink;
    } else {
      for (const k in element) {
        await this.processElement(element[k]);
      }
    }
  }

  async processElements(elements: any[]) {
    for (const element of elements) {
      await this.processElement(element);
    }
  }

  async process() {
    await this.processElements(this.document.body.content);
  }
}
