import {QueueTask} from './QueueTask';
import winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import {GoogleFile} from '../../model/GoogleFile';
import {googleMimeToExt} from '../transform/TaskLocalFileTransform';

export class TaskFetchAsset extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
              private fileService: FileContentService,
              private file: GoogleFile,
              private _forceDownload: boolean) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const ext = googleMimeToExt(this.file.mimeType, this.file.name);
    const targetPath = this.file.id + (ext ? '.' + ext : '');

    if (this.file.md5Checksum) {
      const localMd5 = await this.fileService.md5File(targetPath);
      if (localMd5 === this.file.md5Checksum) {
        return [];
      }
    }

    this.logger.info('Downloading asset: ' + this.file.name);

    try {
      const dest = this.fileService.createWriteStream(targetPath);
      await this.googleDriveService.download(this.auth, this.file, dest);
    } catch (err) {
      await this.fileService.remove(targetPath);
      throw err;
    }

    return [];
  }

}
