'use strict';

import {BasePlugin} from './BasePlugin';
import {LocalFilesStorage} from '../storage/LocalFilesStorage';
import {GoogleFile, GoogleFilesStorage} from '../storage/GoogleFilesStorage';
import {urlToFolderId} from '../utils/idParsers';
import {DriveConfig} from './StoragePlugin';
import {LocalPathGenerator} from '../storage/LocalPathGenerator';

export class LocalPathPlugin extends BasePlugin {
  private googleFilesStorage: GoogleFilesStorage;
  private localFilesStorage: LocalFilesStorage;
  private handlingFiles = false;
  private drive_config: DriveConfig;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({filename: __filename}));

    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });
    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('local_files:initialized', ({ localFilesStorage }) => {
      this.localFilesStorage = localFilesStorage;
    });

    eventBus.on('local_path:run', async () => {
      await this.start();
    });
  }

  private async start() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    const googleFiles: GoogleFile[] = this.googleFilesStorage.findFiles(() => true);

    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    const localPathGenerator = new LocalPathGenerator(this.drive_config.flat_folder_structure);
    const localFiles = await localPathGenerator.generateDesiredPaths(rootFolderId, googleFiles);

    // TODO

    this.handlingFiles = false;
  }
}
