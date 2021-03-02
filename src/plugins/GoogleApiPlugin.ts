'use strict';

import {BasePlugin} from './BasePlugin';
import {QuotaLimiter} from '../google/QuotaLimiter';
import {GoogleAuthService} from '../google/GoogleAuthService';
import {GoogleDriveService} from '../google/GoogleDriveService';
import {ConfigService} from '../storage/ConfigService';
import {DriveConfig} from './ConfigDirPlugin';

export class GoogleApiPlugin extends BasePlugin {
  private command: string;
  private config_dir: string;
  private initial_quota_jobs: any;
  private drive_config: DriveConfig;
  private configService: ConfigService;
  private oldSave: string;

  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.command = params.command;
      this.config_dir = params.config_dir;
    });
    eventBus.on('quota_jobs:loaded', async (quota_jobs) => {
      this.initial_quota_jobs = quota_jobs;
    });
    eventBus.on('drive_config:loaded', async (drive_config) => {
      this.drive_config = drive_config;
      this.configService = new ConfigService(this.config_dir);
      await this.configService.init();
      eventBus.emit('configService:initialized', this.configService);
      await this.onConfigLoaded();
    });
  }

  async onConfigLoaded() {
    const quotaLimiter = new QuotaLimiter(this.initial_quota_jobs);
    quotaLimiter.setInitialLimit(95, 10); // 950, 100 doesn't work as expected
    quotaLimiter.setSaveHandler((jobs) => {
      const str = JSON.stringify(jobs);
      if (this.oldSave === str) {
        return;
      }
      this.eventBus.emit('quota_jobs:save', jobs);
      this.oldSave = str;
    });

    const googleAuthService = new GoogleAuthService(this.configService, quotaLimiter);
    const googleDriveService = new GoogleDriveService();

    switch (this.command) {
      case 'pull':
      case 'watch':
      case 'download':
      case 'drives':
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
