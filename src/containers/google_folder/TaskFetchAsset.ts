import {QueueTask} from './QueueTask';
import * as winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import * as path from 'path';
import {GoogleFile} from '../../model/GoogleFile';

export class TaskFetchAsset extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
              private fileService: FileContentService,
              private file: GoogleFile) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const targetPath = this.file.id + path.extname(this.file.name);

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
