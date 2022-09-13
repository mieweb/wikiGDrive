import {
  Controller,
  RouteErrorHandler,
  RouteParamPath,
  RouteResponse,
  RouteUse
} from './Controller';
import {Logger, QueryOptions} from 'winston';
import {extToMime, ShareErrorHandler} from './FolderController';
import {FileContentService} from '../../../utils/FileContentService';

export class PreviewController extends Controller {
  private fileSystem: FileContentService;

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);

    this.fileSystem = new FileContentService(process.env.VOLUME_PREVIEW);
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(@RouteParamPath('driveId') driveId: string) {
    let filePath = this.req.originalUrl.replace('/preview', '') || '/';

    filePath = filePath.replace(/\?.*$/, '');

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      this.res.status(404).send('Not found');
      return;
    }

    if (await this.fileSystem.isDirectory(filePath)) {
      filePath = filePath + '/index.html';
    }

    if (!await this.fileSystem.exists(filePath)) {
      this.queryLogger.warn(`Not found: ${filePath}`);
      this.res.status(404).send('Not found');
      return;
    }

    const ext = await this.fileSystem.guessExtension(filePath);
    const mimeType = extToMime[ext];

    if (mimeType) {
      this.res.setHeader('Content-type', mimeType);
    }

    const buffer = await this.fileSystem.readBuffer(filePath);
    this.res.send(buffer);
  }
}
