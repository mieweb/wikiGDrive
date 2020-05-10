'use strict';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';

export class FilesStructurePlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      await this.init(params);
      this.resolve();
    });
  }

  async init(params) {
    const filesStructure = new FilesStructure(params.config_dir);
    await filesStructure.init();
    this.eventBus.emit('files_initialized', { filesStructure });
  }
}
