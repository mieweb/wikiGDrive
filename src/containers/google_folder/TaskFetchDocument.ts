import {QueueTask} from './QueueTask';
import winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {FileContentService} from '../../utils/FileContentService';
import {BufferWritable} from '../../utils/BufferWritable';
import {SimpleFile} from '../../model/GoogleFile';
import {HasAccessToken} from '../../google/AuthClient';

export class TaskFetchDocument extends QueueTask {
  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: HasAccessToken,
              private fileService: FileContentService,
              private file: SimpleFile,
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
      { id: this.file.id, mimeType: 'application/vnd.oasis.opendocument.text', name: this.file.name },
      destOdt);

    await this.fileService.writeBuffer(odtPath, destOdt.getBuffer());

    return [];
  }
}
