'use strict';

import {BasePlugin} from './BasePlugin';
import {CliParams} from '../MainService';
import {DriveConfig} from './ConfigDirPlugin';
import {GoogleFiles} from '../storage/GoogleFiles';
import {GoogleDriveService, ListContext} from '../google/GoogleDriveService';
import {urlToFolderId} from '../utils/idParsers';

export class WatchMTimePlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private watch_mode: string;
  private drive_config: DriveConfig;
  private googleFiles: GoogleFiles;
  private auth: any;
  private googleDriveService: GoogleDriveService;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('main:run', async (params: CliParams) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
      this.watch_mode = params.watch_mode;
    });
    eventBus.on('drive_config:loaded', (drive_config: DriveConfig) => {
      this.drive_config = drive_config;
    });
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('watch:run', async () => {
      if (this.watch_mode !== 'mtime') {
        return;
      }
      await this.watch();
    });
  }

  async watch() {
    this.logger.info('Watching changes with mtime');

    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    while (true) { // eslint-disable-line no-constant-condition
      try {
        const context: ListContext = {
          parentId: rootFolderId,
          driveId: this.drive_id ? this.drive_id : undefined,
          modifiedTime: this.googleFiles.getMaxModifiedTime()
        };

        const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context);
        if (changedFiles.length > 0) {
          this.logger.info(changedFiles.length + ' files modified');
          this.eventBus.emit('watch:event', changedFiles.length);
          await this.googleFiles.merge(changedFiles, context.parentId);
          this.eventBus.emit('google_files:dirty');
        } else {
          this.logger.info('No files modified. Sleeping for 10 seconds.');
        }

        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      } catch (e) {
        this.logger.error(e);
      }
    }
  }
}
