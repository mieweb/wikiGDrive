'use strict';

import path from 'path';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';

export class FilesStructurePlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      await this.init(params);
    });
    eventBus.on('list_root:done', async () => {
      await this.scanFileSystem();
    });
  }

  async init(params) {
    const filesStructure = new FilesStructure(params.config_dir);
    this.filesStructure = filesStructure;
    await filesStructure.init();
    this.eventBus.emit('files_structure:initialized', { filesStructure });
  }

  async scanFileSystem() {
    const files = this.filesStructure.findFiles(item => !item.dirty);
    const fileService = new FileService();

    for (const file of files) {
      const targetPath = path.join(this.params.dest, file.localPath);

      if (!await fileService.exists(targetPath)) {
        await this.filesStructure.markDirty([file]);
      }
    }

    this.eventBus.emit('files_structure:dirty');
  }

}
