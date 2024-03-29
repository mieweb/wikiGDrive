import {GoogleDriveService} from '../../google/GoogleDriveService';
import {FileContentService} from '../../utils/FileContentService';
import {INITIAL_RETRIES, QueueTask} from './QueueTask';
import winston from 'winston';
import {TaskFetchDiagram} from './TaskFetchDiagram';
import {TaskFetchDocument} from './TaskFetchDocument';
import {TaskFetchBinary} from './TaskFetchBinary';
import {TaskFetchAsset} from './TaskFetchAsset';
import {MimeTypes, SimpleFile} from '../../model/GoogleFile';
import {FileId} from '../../model/model';
import {HasAccessToken} from '../../google/AuthClient';

interface Filters {
  filterFoldersIds: FileId[];
  filterFilesIds: FileId[];
}

export class TaskFetchFolder extends QueueTask {

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: HasAccessToken,
              private fileService: FileContentService,
              private file: SimpleFile,
              private forceDownloadFilters = false,
              private filters: Filters) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    if (this.filters.filterFoldersIds.length > 0) {
      if (this.filters.filterFoldersIds.indexOf(this.file.id) === -1) {
        return [];
      }
    }

    if (this.retries < INITIAL_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.logger.info('Listening (retry): ' + this.file.id);
    } else {
      this.logger.info('Listening: ' + this.file.id);
    }

    // const rootFolderId = urlToFolderId(this.drive_config['drive']);

    const tasks: QueueTask[] = [];

    const file = await this.googleDriveService.getFile(this.auth, this.file.id);

    if (file.mimeType === MimeTypes.FOLDER_MIME) {
      const oldFiles = await this.fileService.readJson('.folder-files.json') || [];

      await this.fileService.writeJson('.folder.json', file);
      const files = await this.googleDriveService.listFiles(this.auth, { folderId: this.file.id });
      await this.deleteUnused(files);

      const filesToSave = [];

      for (const file of files) {
        const oldFile = oldFiles.find(oldFile => oldFile.id === file.id);

        if (this.filters.filterFilesIds.length > 0) {
          if (this.filters.filterFilesIds.indexOf(file.id) === -1 && this.filters.filterFoldersIds.indexOf(file.id) === -1) {
            if (oldFile) {
              filesToSave.push(oldFile);
            }
            continue;
          }
        }

        filesToSave.push(file);
/*
        const oldFile = oldFiles.find(oldFile => oldFile.id === file.id);
        if (modifiedTime && oldFile.modifiedTime !== file.modifiedTime) {
          const localFiles = await this.fileService.list();
          for (const localFile of localFiles) {
            if (localFile.startsWith(oldFile.id)) {
              await this.fileService.remove(localFile);
            }
          }
        }
*/

        const forceDownload = this.forceDownloadFilters || oldFile?.modifiedTime !== file.modifiedTime;

        switch (file.mimeType) {
          case MimeTypes.FOLDER_MIME:
            tasks.push(new TaskFetchFolder(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService.getSubFileService(file.id),
              file,
              this.forceDownloadFilters,
              this.filters
            ));
            break;

          case MimeTypes.DRAWING_MIME:
            tasks.push(new TaskFetchDiagram(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload
            ));
            break;

          case MimeTypes.DOCUMENT_MIME:
            tasks.push(new TaskFetchDocument(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload
            ));
            break;

          case MimeTypes.SPREADSHEET_MIME:
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'
            ));
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload,
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
              forceDownload,
              'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'
            ));
            tasks.push(new TaskFetchBinary(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload,
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
              forceDownload,
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
              forceDownload,
              'application/vnd.google-apps.script+json', 'gs'
            ));
            break;

          case MimeTypes.SHORTCUT:
            break;

          default:
            tasks.push(new TaskFetchAsset(
              this.logger,
              this.googleDriveService,
              this.auth,
              await this.fileService,
              file,
              forceDownload,
            ));
            break;
        }
      }
      await this.fileService.writeJson('.folder-files.json', filesToSave);
    }

    return tasks;
  }

  private async deleteUnused(files: SimpleFile[]): Promise<void> {
    const localFiles = await this.fileService.list();
    for (const localFile of localFiles) {
      if (localFile === '.logs') continue;
      if (localFile === '.jobs.json') continue;
      if (localFile === '.changes.json') continue;
      if (localFile === '.private') continue;
      if (localFile === '.folder.json') continue;
      if (localFile === '.folder-files.json') continue;
      if (localFile === '.rendered_preview_time') continue;
      if (localFile === '.user_config.json') continue;

      const presentFile = files.find(file => localFile.startsWith(file.id));
      if (presentFile) {
        continue;
      }

      await this.fileService.remove(localFile);
    }
  }
}
