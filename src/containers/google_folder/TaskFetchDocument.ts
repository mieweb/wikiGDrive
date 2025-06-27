import winston from 'winston';
import {QueueTask} from './QueueTask.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {HasAccessToken} from '../../google/AuthClient.ts';

export class TaskFetchDocument extends QueueTask {
  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: HasAccessToken,
              private fileService: FileContentService,
              private file: GoogleFile,
              private forceDownload: boolean) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const odtPath = this.file.id + '.odt';

    if (await this.fileService.exists(odtPath) && !this.forceDownload) {
      return [];
    }

    const destOdt = new BufferWritable();

    await this.googleDriveService.exportDocument(
      this.auth,
      { ...this.file, mimeType: 'application/vnd.oasis.opendocument.text' },
      destOdt);

    await this.fileService.writeBuffer(odtPath, destOdt.getBuffer());

    return [];
  }
}
