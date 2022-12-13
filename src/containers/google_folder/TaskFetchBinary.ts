import {QueueTask} from './QueueTask';
import winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import {SimpleFile} from '../../model/GoogleFile';

export class TaskFetchBinary extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
              private fileService: FileContentService,
              private file: SimpleFile,
              private forceDownload: boolean,
              private mimeType: string,
              private ext: string) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const assetPath = this.file.id + '.' + this.ext;

    if (await this.fileService.exists(assetPath) && !this.forceDownload) {
      return [];
    }

    await this.googleDriveService.exportDocument(
      this.auth,
      { id: this.file.id, mimeType: this.mimeType, name: this.file.name },
      this.fileService.createWriteStream(assetPath)
    );

    return [];
  }


}
