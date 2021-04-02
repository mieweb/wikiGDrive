'use strict';

import {BasePlugin} from './BasePlugin';
import {GoogleDriveService, ListContext} from '../google/GoogleDriveService';
import {DriveConfig} from './StoragePlugin';
import {GoogleFile, GoogleFilesStorage, MimeTypes} from '../storage/GoogleFilesStorage';
import {urlToFolderId} from '../utils/idParsers';
import {ErrorCallback, queue, QueueObject} from 'async';

const INITIAL_RETRIES = 4;
const CONCURRENCY = 4;

export class SyncPlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private force: boolean;
  private drive_config: DriveConfig;
  private googleFilesStorage: GoogleFilesStorage;
  private googleDriveService: GoogleDriveService;
  private auth: any;
  private googleFileIds: string[];

  private progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private handlingFiles = false;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.googleFileIds = [];

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });

    eventBus.on('main:run', async (params) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
      this.force = !!params.force;
    });
    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });
    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('sync:run', async () => {
      await this.start();
    });
  }

  async processQueueTask(q: QueueObject<ListContext>, context: ListContext, callback: ErrorCallback<Error>) {
    try {
      if (context.retries < INITIAL_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (context.parentName) {
          this.logger.info('Listening (retry): ' + context.parentName);
        }
      } else {
        if (context.parentName) {
          this.logger.info('Listening: ' + context.parentName);
        }
      }

      if (context.fileId) {
        try {
          const googleFile: GoogleFile = await this.googleDriveService.getFile(this.auth, context.fileId);

          if (googleFile.mimeType === MimeTypes.FOLDER_MIME) {
            this.progress.total++;
            this.eventBus.emit('sync:progress', this.progress);
            q.push({
              retries: INITIAL_RETRIES,
              parentName: context.fileId + '/',
              parentId: googleFile.id,
              driveId: this.drive_id ? this.drive_id : undefined,
            });
          }

          await this.googleFilesStorage.mergeSingleFile(googleFile);
        } catch (err) {
          if (404 === err.origError?.code) {
            await this.googleFilesStorage.removeFile(context.fileId);
          } else {
            throw err;
          }
        }
      }

      if (context.parentId) {
        const googleFiles: GoogleFile[] = (await this.googleDriveService.listFiles(this.auth, context))
          .map(file => {file.parentId = context.parentId; return file;});
        const folders = googleFiles.filter(file => file.mimeType === MimeTypes.FOLDER_MIME);

        for (const folder of folders) {
          const folderContext: ListContext = {
            parentId: folder.id,
            driveId: this.drive_id ? this.drive_id : undefined,
            parentName: context.parentName ? context.parentName + folder.name + '/' : undefined,
            retries: INITIAL_RETRIES
          };

          this.progress.total++;
          this.eventBus.emit('sync:progress', this.progress);
          q.push(folderContext);
        }

        await this.googleFilesStorage.mergeFullDir(googleFiles, context.parentId);
      }


      this.progress.completed++;
      this.eventBus.emit('sync:progress', this.progress);
      await new Promise(resolve => setTimeout(resolve, 500));

      callback();
    } catch (err) {
      callback(err);
    }
  }

  async start() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    const q = queue<ListContext>(async (context, callback) => this.processQueueTask(q, context, callback), CONCURRENCY);

    q.error((err, context) => {
      this.logger.error(err);
      if (context.retries > 0) {
        context.retries--;
        q.push(context);
      } else {
        this.progress.failed++;
        this.eventBus.emit('sync:progress', this.progress);
      }
    });

    if (this.googleFileIds.length > 0) {
      for (const fileId of this.googleFileIds) {
        const context: ListContext = {
          retries: INITIAL_RETRIES,
          parentName: fileId + '/',
          fileId,
          parentId: null,
          driveId: this.drive_id ? this.drive_id : undefined,
        };

        q.push(context);
        this.progress.total++;
        this.eventBus.emit('sync:progress', this.progress);
      }
    } else {
      const context: ListContext = {
        retries: INITIAL_RETRIES,
        parentName: '/',
        parentId: rootFolderId,
        driveId: this.drive_id ? this.drive_id : undefined,
      };

      q.push(context);
      this.progress.total++;
      this.eventBus.emit('sync:progress', this.progress);
    }

    try {
      await q.drain();
    } catch (e) {
      this.eventBus.emit('panic', e);
      return;
    }

    this.logger.info('Listening Google Drive done');
    this.eventBus.emit('sync:done', this.progress);
    this.handlingFiles = false;
  }
}
