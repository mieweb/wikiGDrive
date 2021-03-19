'use strict';

import * as path from 'path';

import {BasePlugin} from './BasePlugin';
import {GoogleFiles} from '../storage/GoogleFiles';
import {FileService} from '../utils/FileService';
import {DriveConfig} from './ConfigDirPlugin';

export class GoogleFilesPlugin extends BasePlugin {
  private flat_folder_structure: boolean;
  private config_dir: any;
  private googleFiles: GoogleFiles;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.flat_folder_structure = drive_config.flat_folder_structure;
      await this.init();
    });
    eventBus.on('list_root:done', async () => {
      await this.scanFileSystem();
      this.eventBus.emit('google_files:dirty');
    });
  }

  async init() {
    const googleFiles = new GoogleFiles(this.config_dir, this.flat_folder_structure);
    this.googleFiles = googleFiles;
    await googleFiles.init();
    await this.cleanupDir();
    await this.scanFileSystem();

    this.eventBus.emit('google_files:initialized', { googleFiles });
  }

  async cleanupDir() {
    const files = this.googleFiles.findFiles(item => GoogleFiles.DOCUMENT_MIME === item.mimeType);
    const fileService = new FileService();

    for (const file of files) {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
      if (await fileService.exists(targetPath) && await fileService.getSize(targetPath) === 0) {
        await fileService.remove(targetPath);
      }
    }
  }

  async status() {
    const allFiles = this.googleFiles.findFiles(item => !!item);
    const dirtyFiles = this.googleFiles.findFiles(item => !!item.dirty && !item.trashed);
    console.log('Files status:');
    console.table({
      'All files': allFiles.length,
      'Dirty files': dirtyFiles.length
    });
  }

  async scanFileSystem() {
    const files = this.googleFiles.findFiles(item => !item.dirty);
    const fileService = new FileService();

    for (const file of files) {
      let targetPath;
      switch (file.mimeType) {
        case GoogleFiles.DOCUMENT_MIME:
          targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
          break;
        case GoogleFiles.DRAWING_MIME:
          targetPath = path.join(this.config_dir, 'files', file.id + '.svg');
          break;
      }

      if (!targetPath) {
        continue;
      }

      if (!await fileService.exists(targetPath)) {
        await this.googleFiles.markDirty([file]);
      } else
      if (await fileService.getSize(targetPath) === 0) {
        await this.googleFiles.markDirty([file]);
      }
    }
  }

  async flushData() {
    return await this.googleFiles.flushData();
  }

}
