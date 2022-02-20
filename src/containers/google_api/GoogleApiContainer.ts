import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {GoogleAuthService} from '../../google/GoogleAuthService';
import {QuotaLimiter} from '../../google/QuotaLimiter';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {HasQuotaLimiter} from '../../google/AuthClient';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {ServiceAccountJson, UserAccountJson} from '../../model/AccountJson';

export class GoogleApiContainer extends Container {
  private logger: winston.Logger;
  private oldSave: string;
  private auth: OAuth2Client & HasQuotaLimiter;

  constructor(public readonly params: ContainerConfig, private authConfig: UserAccountJson | ServiceAccountJson) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    const initial_quota_jobs = await this.googleFilesService.readJson('quota.json') || [];
    const quotaLimiter = new QuotaLimiter(initial_quota_jobs, this.logger);
    quotaLimiter.setInitialLimit(95, 10); // 950, 100 doesn't work as expected
    quotaLimiter.setSaveHandler(async (jobs) => {
      const str = JSON.stringify(jobs);
      if (this.oldSave === str) {
        return;
      }

      await this.googleFilesService.writeJson('quota.json', jobs);
      this.oldSave = str;
    });

    const googleAuthService = new GoogleAuthService();
    if (this.authConfig.type === 'service_account') {
      this.auth = await googleAuthService.authorizeServiceAccount(this.authConfig);
      this.auth.setQuotaLimiter(quotaLimiter);
    } else
    if (this.authConfig.type === 'user_account') {
      this.auth = await googleAuthService.authorizeUserAccount(this.authConfig.client_id, this.authConfig.client_secret);

      const google_auth = await this.googleFilesService.readJson('auth_token.json');
      if (google_auth) {
        this.auth.setCredentials(google_auth);
      } else {
        const google_auth = await googleAuthService.getCliAccessToken(this.auth);
        await this.googleFilesService.writeJson('auth_token.json', google_auth);
        this.auth.setCredentials(google_auth);
      }
      this.auth.setQuotaLimiter(quotaLimiter);
    }
  }

  async run() {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async listDrives() {
    const googleDriveService = new GoogleDriveService(this.logger);
    return await googleDriveService.listDrives(this.auth);
  }

  getAuth(): OAuth2Client {
    return this.auth;
  }
}
