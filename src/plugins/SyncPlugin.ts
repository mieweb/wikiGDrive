'use strict';

import {BasePlugin} from './BasePlugin';
import {GoogleDriveService, ListContext} from '../google/GoogleDriveService';
import {DriveConfig} from './ConfigDirPlugin';
import {GoogleFiles} from '../storage/GoogleFiles';
import {urlToFolderId} from '../utils/idParsers';

export class SyncPlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private force: boolean;
  private drive_config: DriveConfig;
  private googleFiles: GoogleFiles;
  private googleDriveService: GoogleDriveService;
  private auth: any;
  private googleFileIds: string[];

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.googleFileIds = [];

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
    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    const context: ListContext = {
      fileIds: [],
      folderId: rootFolderId,
      driveId: undefined
    };
    if (this.drive_id) {
      context.driveId = this.drive_id;
    }

    const lastMTime = this.force ? null : this.googleFiles.getMaxModifiedTime();

    if (this.googleFileIds.length > 0) {
      console.log(this.googleFileIds); // TODO
    } else {
      try {
        const apiFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
        const changedFiles = apiFiles.map(file => {
          if (file.parentId === rootFolderId) {
            file.parentId = undefined;
          }
          return file;
        });

        await this.googleFiles.merge(changedFiles);
      } catch (e) {
        this.eventBus.emit('panic', e);
        return;
      }
    }

    this.logger.info('Listening Google Drive done');

    this.eventBus.emit('sync:done', {
      context,
      lastMTime
    });
  }
}
