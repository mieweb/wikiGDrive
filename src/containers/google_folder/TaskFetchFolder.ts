import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import {INITIAL_RETRIES, QueueTask} from './QueueTask';
import * as winston from 'winston';
import {TaskFetchDiagram} from './TaskFetchDiagram';
import {TaskFetchDocument} from './TaskFetchDocument';
import {TaskFetchBinary} from './TaskFetchBinary';
import {TaskFetchAsset} from './TaskFetchAsset';
import {MimeTypes, SimpleFile} from '../../model/GoogleFile';

export class TaskFetchFolder extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
              private fileService: FileContentService,
              private file: SimpleFile) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    if (this.retries < INITIAL_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.logger.info('Listening (retry): ' + this.file.id);
    } else {
      this.logger.info('Listening: ' + this.file.id);
    }

    // const rootFolderId = urlToFolderId(this.drive_config['drive']);

    const tasks: QueueTask[] = [];

    const file = await this.googleDriveService.getFile(this.auth, this.file.id);
    // console.log('file', file);

    if (file.mimeType === MimeTypes.FOLDER_MIME) {
      const oldFiles = await this.fileService.readJson('.folder-files.json') || [];

      await this.fileService.writeJson('.folder.json', file);
      const files = await this.googleDriveService.listFiles(this.auth, { folderId: this.file.id });
      await this.fileService.writeJson('.folder-files.json', files);
      await this.deleteUnused(files);

      for (const file of files) {
/*
        const oldFile = oldFiles.find(oldFile => oldFile.id === file.id);
        if (oldFile && oldFile.version !== file.version) {
          const localFiles = await this.fileService.list();
          for (const localFile of localFiles) {
            if (localFile.startsWith(oldFile.id)) {
              await this.fileService.remove(localFile);
            }
          }
        }
*/

        switch (file.mimeType) {
          case MimeTypes.FOLDER_MIME:
            tasks.push(new TaskFetchFolder(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService.getSubFileService(file.id),
              file
            ));
            break;

          case MimeTypes.DRAWING_MIME:
            tasks.push(new TaskFetchDiagram(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file
            ));
            break;

          case MimeTypes.DOCUMENT_MIME:
            tasks.push(new TaskFetchDocument(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file
            ));
            break;

          case MimeTypes.SPREADSHEET_MIME:
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'
            ));
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'text/csv', 'csv'
            ));
            break;

          case MimeTypes.PRESENTATION_MIME:
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'
            ));
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'application/pdf', 'pdf'
            ));
            break;

          case MimeTypes.FORM_MIME:
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'application/zip', 'zip'
            ));
            break;

          case MimeTypes.APPS_SCRIPT:
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              'application/vnd.google-apps.script+json', 'gson'
            ));
            break;

          default:
            tasks.push(new TaskFetchAsset(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
            ));
            break;
        }
      }
    }
    return tasks;
  }

  private async deleteUnused(files: SimpleFile[]): Promise<void> {
    const localFiles = await this.fileService.list();
    for (const localFile of localFiles) {
      if (localFile === '.folder.json') continue;
      if (localFile === '.folder-files.json') continue;

      const presentFile = files.find(file => localFile.startsWith(file.id));
      if (presentFile) {
        continue;
      }

      await this.fileService.remove(localFile);
    }
  }
}
