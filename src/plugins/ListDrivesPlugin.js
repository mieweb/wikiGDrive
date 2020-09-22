'use strict';

import {BasePlugin} from './BasePlugin';

export class ListDrivesPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('google_api:initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('main:run_list_drives', async () => {
      await this.start();
    });
  }

  async start() {
    try {
      console.log('Listening Google Drives');
      const drives = await this.googleDriveService.listDrives(this.auth);
      this.eventBus.emit('list_drives:done', drives);
    } catch (e) {
      this.eventBus.emit('panic', {
        message: e.message
      });
    }
  }

}
