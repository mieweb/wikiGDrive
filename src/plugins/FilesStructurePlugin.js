'use strict';

import path from 'path';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';

export class FilesStructurePlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.params = params;
      this.config_dir = params.config_dir;
      await this.init(params);
    });
    eventBus.on('list_root:done', async () => {
      // this.eventBus.emit('files_structure:dirty');
      await this.scanFileSystem();
    });
  }

  async init(params) {
    const filesStructure = new FilesStructure(params.config_dir);
    this.filesStructure = filesStructure;
    await filesStructure.init();
    await this.cleanupDir();

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
    const dirtyFiles = this.filesStructure.findFiles(item => !!item.dirty);
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

    this.eventBus.emit('files_structure:dirty');
  }

}
