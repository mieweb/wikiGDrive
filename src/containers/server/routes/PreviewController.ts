import process from 'node:process';

import {Logger} from 'winston';

import {
  Controller, type ControllerCallContext,
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
  async getFolder(ctx: ControllerCallContext) {
    const relativeUrl = ctx.req.originalUrl || '/';

    let filePath = relativeUrl.replace('/preview', '').replace(/\?.*$/, '');

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      ctx.res.status(404).send('Not found');
      return;
    }

    if (await this.fileSystem.isDirectory(filePath)) {
      if (!relativeUrl.endsWith('/')) {
        ctx.res
          .status(301)
          .setHeader('location', relativeUrl + '/')
          .send();
        return;
      }

      filePath = filePath + '/index.html';
    }

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      ctx.res.status(404).send('Not found');
      return;
    }

    const ext = filePath.substring(filePath.lastIndexOf('.') + 1);
    const guessedExt = await this.fileSystem.guessExtension(filePath);
    const mimeType = extToMime[ext] || extToMime[guessedExt];

    if (mimeType) {
      ctx.res.setHeader('Content-type', mimeType);
    }

    const buffer = await this.fileSystem.readBuffer(filePath);
    ctx.res.send(buffer);
  }
}
