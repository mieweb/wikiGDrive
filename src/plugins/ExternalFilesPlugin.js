'use strict';

import {BasePlugin} from './BasePlugin';
import {HttpClient} from '../utils/HttpClient';
import {ExternalFiles} from '../ExternalFiles';

export class ExternalFilesPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      await this.init(params);
    });

    // TODO trigger await this.externalFiles.cleanup();
  }

  async init(params) {
    const externalFiles = new ExternalFiles(params.config_dir, new HttpClient(), params.dest);
    await externalFiles.init();
    this.eventBus.emit('external_files:initialized', { externalFiles });
  }
}
