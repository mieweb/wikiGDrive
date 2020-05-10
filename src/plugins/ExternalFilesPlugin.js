'use strict';

import {BasePlugin} from './BasePlugin';
import {HttpClient} from '../utils/HttpClient';
import {ExternalFiles} from '../ExternalFiles';

export class ExternalFilesPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      await this.init(params);
      this.resolve();
    });
  }

  async init(params) {
    const externalFiles = new ExternalFiles(params.config_dir, new HttpClient(), params.dest);
    await externalFiles.init();
    this.eventBus.emit('external_files_initialized', { externalFiles });
  }
}
