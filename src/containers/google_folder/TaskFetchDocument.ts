import {QueueTask} from './QueueTask';
import winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import {BufferWritable} from '../../utils/BufferWritable';
import {SimpleFile} from '../../model/GoogleFile';

export class TaskFetchDocument extends QueueTask {
  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
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
