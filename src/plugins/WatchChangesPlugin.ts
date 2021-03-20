'use strict';

import {BasePlugin} from './BasePlugin';
import {CliParams} from '../MainService';
import {DriveConfig} from './ConfigDirPlugin';
import {GoogleFiles} from '../storage/GoogleFiles';
import {GoogleDriveService} from '../google/GoogleDriveService';
import {urlToFolderId} from '../utils/idParsers';

export class WatchChangesPlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private watch_mode: string;
  private debug: string[];
  private drive_config: DriveConfig;
  private googleFiles: GoogleFiles;
  private auth: any;
  private googleDriveService: GoogleDriveService;
  private startTrackToken: string;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('main:run', async (params: CliParams) => {
      this.command = params.command;
      this.watch_mode = params.watch_mode;
      this.debug = params.debug;
    });
    eventBus.on('drive_config:loaded', (drive_config: DriveConfig) => {
      this.drive_config = drive_config;
      this.drive_id = drive_config.drive_id;
    });
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('watch_changes:fetch_token', async () => {
      if (this.watch_mode !== 'changes') {
        return;
      }
      this.startTrackToken = await this.googleDriveService.getStartTrackToken(this.auth, this.drive_id);
      eventBus.emit('watch_changes:token_ready');
    });
    eventBus.on('watch:run', async () => {
      if (this.watch_mode !== 'changes') {
        return;
      }
      await this.watch();
    });
  }

  async watch() {
    this.logger.info('Watching changes');
    this.eventBus.emit('watch:event');
    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    await new Promise(() => setInterval(async () => {
      try {
        const result = await this.googleDriveService.watchChanges(this.auth, this.startTrackToken, this.drive_id);

        const apiFiles = result.files.filter(file => {
          let retVal = false;
          file.parents.forEach((parentId) => {
            if (parentId === rootFolderId) {
              retVal = true;
            }
            if (this.googleFiles.containsFile(parentId)) {
              retVal = true;
            }
          });
          return retVal;
        });

        const externalDocs = result.files.filter(file => !apiFiles.find(apiFile => apiFile.id === file.id));

        const changedFiles = apiFiles.map(file => {
          if (file.parentId === rootFolderId) {
            file.parentId = undefined;
          }
          return file;
        });

        this.eventBus.emit('watch:event', changedFiles.length);

        if (changedFiles.length === 0 && externalDocs.length === 0) {
          this.logger.debug('No changes detected. Sleeping for 10 seconds.');
        }

        if (changedFiles.length > 0) {
          this.logger.info(changedFiles.length + ' files changed');
          await this.googleFiles.merge(changedFiles);
        }

        if (externalDocs.length > 0) {
          this.logger.info('Files outside folder: ' + externalDocs.length);
          await this.googleFiles.merge(externalDocs);
        }

        this.startTrackToken = result.token; // eslint-disable-line require-atomic-updates
        this.logger.debug('Pulled latest changes');
        this.eventBus.emit('google_files:dirty');

      } catch (e) {
        this.logger.error(e);
      }
    }, 10000));
  }
}
