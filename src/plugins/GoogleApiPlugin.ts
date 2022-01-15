'use strict';

import {BasePlugin} from './BasePlugin';
import {QuotaLimiter} from '../google/QuotaLimiter';
import {GoogleAuthService} from '../google/GoogleAuthService';
import {ConfigService} from '../storage/ConfigService';
import {AuthConfig} from './StoragePlugin';

export class GoogleApiPlugin extends BasePlugin {
  private command: string;
  private config_dir: string;
  private initial_quota_jobs: any;
  private auth_config: AuthConfig;
  private configService: ConfigService;
  private oldSave: string;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('main:run', async (params) => {
      this.command = params.command;
      this.config_dir = params.config_dir;
    });
    eventBus.on('quota_jobs:loaded', async (quota_jobs) => {
      this.initial_quota_jobs = quota_jobs;
    });
    eventBus.on('drive_config:loaded', async () => {
      this.configService = new ConfigService(this.config_dir);
      await this.configService.init();
      eventBus.emit('configService:initialized', this.configService);
    });
    eventBus.on('auth_config:loaded', async (auth_config: AuthConfig) => {
      this.auth_config = auth_config;
      await this.onConfigLoaded();
    });
  }

  async onConfigLoaded() {
    const quotaLimiter = new QuotaLimiter(this.initial_quota_jobs, this.eventBus, this.logger);
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

    switch (this.command) {
      case 'pull':
      case 'watch':
      case 'download':
      case 'external':
      case 'drives':
      case 'sync':
        if (this.auth_config.service_account_json) {
          const auth = await googleAuthService.authorizeServiceAccount(this.auth_config.service_account_json);
          this.eventBus.emit('google_api:done', {
            auth
          });
        } else
        if (this.auth_config.client_id) {
          this.eventBus.emit('progress:pause');
          const auth = await googleAuthService.authorize(this.auth_config.client_id, this.auth_config.client_secret);
          this.eventBus.emit('progress:unpause');
          this.eventBus.emit('google_api:done', {
            auth
          });
        } else {
          console.error('No auth data');
          this.eventBus.emit('google_api:done', {
          });
        }
        break;
    }
  }
}
