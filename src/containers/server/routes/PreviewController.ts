import {Logger} from 'winston';

import {
  Controller,
  RouteErrorHandler,
  RouteResponse,
  RouteUse
} from './Controller.ts';
import {extToMime, ShareErrorHandler} from './FolderController.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';

export class PreviewController extends Controller {
  private fileSystem: FileContentService;

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);

    this.fileSystem = new FileContentService(process.env.VOLUME_PREVIEW);
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder() {
    const relativeUrl = this.req.originalUrl || '/';

    let filePath = relativeUrl.replace('/preview', '').replace(/\?.*$/, '');

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      this.res.status(404).send('Not found');
      return;
    }

    if (await this.fileSystem.isDirectory(filePath)) {
      if (!relativeUrl.endsWith('/')) {
        this.res
          .status(301)
          .setHeader('location', relativeUrl + '/')
          .send();
        return;
      }

      filePath = filePath + '/index.html';
    }

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      this.res.status(404).send('Not found');
      return;
    }

    const ext = filePath.substring(filePath.lastIndexOf('.') + 1);
    const guessedExt = await this.fileSystem.guessExtension(filePath);
    const mimeType = extToMime[ext] || extToMime[guessedExt];

    if (mimeType) {
      this.res.setHeader('Content-type', mimeType);
    }

    const buffer = await this.fileSystem.readBuffer(filePath);
    this.res.send(buffer);
  }
}
