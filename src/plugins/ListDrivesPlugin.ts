'use strict';

import {BasePlugin} from './BasePlugin';
import {GoogleDriveService} from '../google/GoogleDriveService';

export class ListDrivesPlugin extends BasePlugin {
  private auth: any;
  private googleDriveService: GoogleDriveService;
  
  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('list_drives:run', async () => {
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
