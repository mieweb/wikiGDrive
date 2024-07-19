import winston from 'winston';
import {QueueTask} from './QueueTask.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {SimpleFile} from '../../model/GoogleFile.ts';
import {HasAccessToken} from '../../google/AuthClient.ts';

export class TaskFetchDiagram extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: HasAccessToken,
              private fileService: FileContentService,
              private file: SimpleFile,
              private forceDownload: boolean) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const targetPathSvg = this.file.id + '.svg';
    const targetPathPng = this.file.id + '.png';

    if (await this.fileService.exists(targetPathPng) && await this.fileService.exists(targetPathSvg) && !this.forceDownload) {
      return [];
    }

    this.logger.info('Downloading diagram: ' + this.file.name);

    const writeStream = this.fileService.createWriteStream(targetPathSvg);
    await this.googleDriveService.exportDocument(
      this.auth,
      Object.assign({}, this.file, { mimeType: 'image/svg+xml' }),
      writeStream);

    const writeStreamPng = this.fileService.createWriteStream(targetPathPng);
    await this.googleDriveService.exportDocument(
      this.auth,
      Object.assign({}, this.file, { mimeType: 'image/png' }),
      writeStreamPng);

/*    const md5Checksum = await this.fileService.md5File(targetPathPng);
    console.log('md5Checksum', md5Checksum);

    const image = await getImageMeta(await this.fileService.readBuffer(targetPathPng));
    console.log('image', image);*/

    return [];
  }

}
