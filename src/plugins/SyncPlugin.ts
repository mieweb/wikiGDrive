'use strict';

import {BasePlugin} from './BasePlugin';
import {GoogleDriveService, ListContext} from '../google/GoogleDriveService';
import {DriveConfig} from './ConfigDirPlugin';
import {GoogleFile, GoogleFiles, MimeTypes} from '../storage/GoogleFiles';
import {urlToFolderId} from '../utils/idParsers';
import {queue} from 'async';

export class SyncPlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private force: boolean;
  private drive_config: DriveConfig;
  private googleFiles: GoogleFiles;
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
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('sync:run', async () => {
      await this.start();
    });
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

    const INITIAL_RETRIES = 4;
    const CONCURRENCY = 4;

    const q = queue<ListContext>(async (context, callback) => {
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

        const apiFiles: GoogleFile[] = await this.googleDriveService.listFiles(this.auth, context);

        const folders = apiFiles.filter(file => file.mimeType === MimeTypes.FOLDER_MIME);

        for (const folder of folders) {
          const folderContext: ListContext = {
            fileIds: [],
            parentId: folder.id,
            driveId: this.drive_id ? this.drive_id : undefined,
            parentName: context.parentName ? context.parentName + folder.name + '/' : undefined,
            retries: INITIAL_RETRIES
          };

          this.progress.total++;
          this.eventBus.emit('sync:progress', this.progress);
          q.push(folderContext);
        }

        const changedFiles = apiFiles.map(file => {
          if (file.parentId === rootFolderId) {
            file.parentId = undefined;
          }
          return file;
        });

        await this.googleFiles.merge(changedFiles);

        this.progress.completed++;
        this.eventBus.emit('sync:progress', this.progress);
        await new Promise(resolve => setTimeout(resolve, 500));

        callback();
      } catch (err) {
        callback(err);
      }
    }, CONCURRENCY);

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
      const context: ListContext = {
        retries: INITIAL_RETRIES,
        // parentName: '/', // TODO
        fileIds: this.googleFileIds,
        parentId: null,
        driveId: this.drive_id ? this.drive_id : undefined,
      };

      this.progress.total++;
      this.eventBus.emit('sync:progress', this.progress);
      q.push(context);
      await q.drain();
    } else {
      try {
        const context: ListContext = {
          retries: INITIAL_RETRIES,
          parentName: '/',
          fileIds: [],
          parentId: rootFolderId,
          driveId: this.drive_id ? this.drive_id : undefined,
        };

        this.progress.total++;
        this.eventBus.emit('sync:progress', this.progress);
        q.push(context);
        await q.drain();
      } catch (e) {
        this.eventBus.emit('panic', e);
        return;
      }

    }

    this.logger.info('Listening Google Drive done');
    this.eventBus.emit('sync:done', this.progress);
    this.handlingFiles = false;
  }
}
