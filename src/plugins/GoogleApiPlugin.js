'use strict';

import {BasePlugin} from './BasePlugin';
import {QuotaLimiter} from '../google/QuotaLimiter';
import {GoogleAuthService} from '../google/GoogleAuthService';
import {GoogleDriveService} from '../google/GoogleDriveService';

export class GoogleApiPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      this.command = params.command;
    });
    eventBus.on('drive_config', async (drive_config) => {
      this.drive_config = drive_config;
      await this.onConfigLoaded();
    });
  }

  async onConfigLoaded() {
    // console.log(this.drive_config);

    const quotaLimiter = new QuotaLimiter(9500, 100);
    // const quotaLimiter = new QuotaLimiter(1, 5);

    const googleAuthService = new GoogleAuthService(this.configService, quotaLimiter);
    const googleDriveService = new GoogleDriveService(this.drive_config.flat_folder_structure);

    switch (this.command) {
      case 'pull':
      case 'watch':
        if (this.drive_config.service_account) {
          const auth = await googleAuthService.authorizeServiceAccount(this.drive_config.service_account);
          this.eventBus.emit('google_api_initialized', {
            auth,
            googleDriveService
          });
        } else {
          const auth = await googleAuthService.authorize(this.drive_config.client_id, this.drive_config.client_secret);
          this.eventBus.emit('google_api_initialized', {
            auth,
            googleDriveService
          });
        }

        this.resolve();
        break;
      default:
        this.reject();
    }
  }
}
