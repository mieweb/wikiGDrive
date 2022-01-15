'use strict';

import {BasePlugin} from './BasePlugin';
import {GoogleDriveService} from '../google/GoogleDriveService';

export class ListDrivesPlugin extends BasePlugin {
  private auth: any;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('google_api:done', ({ auth }) => {
      this.auth = auth;
    });
    eventBus.on('list_drives:run', async () => {
      await this.start();
    });
  }

  async start() {
    try {
      const googleDriveService = new GoogleDriveService(this.eventBus, this.logger);
      const drives = await googleDriveService.listDrives(this.auth);
      this.eventBus.emit('list_drives:done', drives);
    } catch (e) {
      this.eventBus.emit('panic', {
        message: e.message
      });
    }
  }

}
