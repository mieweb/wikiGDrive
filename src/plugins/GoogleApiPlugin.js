'use strict';

import {BasePlugin} from './BasePlugin';
import {QuotaLimiter} from '../google/QuotaLimiter';
import {GoogleAuthService} from '../google/GoogleAuthService';
import {GoogleDriveService} from '../google/GoogleDriveService';

export class GoogleApiPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.command = params.command;
    });
    eventBus.on('quota_jobs:loaded', async (quota_jobs) => {
      this.initial_quota_jobs = quota_jobs;
    });
    eventBus.on('drive_config:loaded', async (drive_config) => {
      this.drive_config = drive_config;
      await this.onConfigLoaded();
    });
  }

  async onConfigLoaded() {
    const quotaLimiter = new QuotaLimiter(this.initial_quota_jobs);
    // quotaLimiter.addLimit(950, 100);
    quotaLimiter.addLimit(95, 10);
    quotaLimiter.setSaveHandler((jobs) => {
      const str = JSON.stringify(jobs);
      if (this.oldSave === str) {
        return;
      }
      this.eventBus.emit('quota_jobs:save', jobs);
      this.oldSave = str;
    });

    const googleAuthService = new GoogleAuthService(this.configService, quotaLimiter);
    const googleDriveService = new GoogleDriveService(this.drive_config.flat_folder_structure);

    switch (this.command) {
      case 'pull':
      case 'watch':
        if (this.drive_config.service_account) {
          const auth = await googleAuthService.authorizeServiceAccount(this.drive_config.service_account);
          this.eventBus.emit('google_api:initialized', {
            auth,
            googleDriveService
          });
        } else {
          const auth = await googleAuthService.authorize(this.drive_config.client_id, this.drive_config.client_secret);
          this.eventBus.emit('google_api:initialized', {
            auth,
            googleDriveService
          });
        }
        break;
    }
  }
}
