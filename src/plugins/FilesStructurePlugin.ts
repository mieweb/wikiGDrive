'use strict';

import * as path from 'path';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';
import {DriveConfig} from './ConfigDirPlugin';

export class FilesStructurePlugin extends BasePlugin {
  private flat_folder_structure: boolean;
  private config_dir: any;
  private filesStructure: FilesStructure;
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.flat_folder_structure = drive_config.flat_folder_structure;
      await this.init();
    });
    eventBus.on('list_root:done', async () => {
      await this.scanFileSystem();
      this.eventBus.emit('files_structure:dirty');
    });
  }

  async init() {
    const filesStructure = new FilesStructure(this.config_dir, this.flat_folder_structure);
    this.filesStructure = filesStructure;
    await filesStructure.init();
    await this.cleanupDir();
    await this.scanFileSystem();

    this.eventBus.emit('files_structure:initialized', { filesStructure });
  }

  async cleanupDir() {
    const files = this.filesStructure.findFiles(item => FilesStructure.DOCUMENT_MIME === item.mimeType);
    const fileService = new FileService();

    for (const file of files) {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
      if (await fileService.exists(targetPath) && await fileService.getSize(targetPath) === 0) {
        await fileService.remove(targetPath);
      }
    }
  }

  async status() {
    const allFiles = this.filesStructure.findFiles(item => !!item);
    const dirtyFiles = this.filesStructure.findFiles(item => !!item.dirty && !item.trashed);
    console.log('Files status:');
    console.table({
      'All files': allFiles.length,
      'Dirty files': dirtyFiles.length
    });
  }

  async scanFileSystem() {
    const files = this.filesStructure.findFiles(item => !item.dirty);
    const fileService = new FileService();

    for (const file of files) {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

      if (!await fileService.exists(targetPath)) {
        await this.filesStructure.markDirty([file]);
      } else
      if (await fileService.getSize(targetPath) === 0) {
        await this.filesStructure.markDirty([file]);
      }
    }
  }

  async flushData() {
    return await this.filesStructure.flushData();
  }

}
