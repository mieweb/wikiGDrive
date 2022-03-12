import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {GoogleAuthService} from '../../google/GoogleAuthService';
import {QuotaLimiter} from '../../google/QuotaLimiter';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {HasQuotaLimiter} from '../../google/AuthClient';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {AuthConfig} from '../../model/AccountJson';
import {GoogleAuth} from '../../storage/ConfigService';
import {Drive} from '../folder_registry/FolderRegistryContainer';
import {FileId} from '../../model/model';
import {GoogleFile} from '../../model/GoogleFile';

export class GoogleApiContainer extends Container {
  private logger: winston.Logger;
  private oldSave: string;
  private auth: OAuth2Client & HasQuotaLimiter;
  private webAuth: OAuth2Client & HasQuotaLimiter;

  constructor(public readonly params: ContainerConfig, public authConfig: AuthConfig) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    const initial_quota_jobs = await this.filesService.readJson('quota.json') || [];
    const quotaLimiter = new QuotaLimiter(initial_quota_jobs, this.logger);
    quotaLimiter.setInitialLimit(95, 10); // 950, 100 doesn't work as expected
    quotaLimiter.setSaveHandler(async (jobs) => {
      const str = JSON.stringify(jobs);
      if (this.oldSave === str) {
        return;
      }

      await this.filesService.writeJson('quota.json', jobs);
      this.oldSave = str;
    });

    const googleAuthService = new GoogleAuthService();
    if (this.authConfig.service_account) {
      this.auth = await googleAuthService.authorizeServiceAccount(this.authConfig.service_account);
      this.auth.setQuotaLimiter(quotaLimiter);
    }
    if (this.authConfig.user_account) {
      this.auth = await googleAuthService.authorizeUserAccount(this.authConfig.user_account.client_id, this.authConfig.user_account.client_secret);

      const google_auth = await this.filesService.readJson('auth_token.json');
      if (google_auth) {
        this.auth.setCredentials(google_auth);
      } else {
        const google_auth = await googleAuthService.getCliAccessToken(this.auth);
        await this.filesService.writeJson('auth_token.json', google_auth);
        this.auth.setCredentials(google_auth);
      }

      this.auth.setQuotaLimiter(quotaLimiter);
    }
    if (this.authConfig.web_account) {
      this.webAuth = await googleAuthService.authorizeUserAccount(this.authConfig.web_account.client_id, this.authConfig.web_account.client_secret);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async listDrives(): Promise<Drive[]> {
    const googleDriveService = new GoogleDriveService(this.logger);
    return await googleDriveService.listDrives(this.auth);
  }

  async getFolder(fileId: FileId): Promise<GoogleFile> {
    const googleDriveService = new GoogleDriveService(this.logger);
    return await googleDriveService.getFile(this.auth, fileId);
  }

  getAuth(): OAuth2Client {
    return this.auth;
  }

  getWebAuth(): OAuth2Client {
    return this.webAuth;
  }

  async getWebAuthUrl(redirect_uri: string, state: string): Promise<string> {
    const googleAuthService = new GoogleAuthService();
    return await googleAuthService.getWebAuthUrl(this.webAuth, redirect_uri, state);
  }

  async getWebToken(redirect_uri: string, code: string): Promise<GoogleAuth> {
    const googleAuthService = new GoogleAuthService();
    return await googleAuthService.getWebToken(this.webAuth, redirect_uri, code);
  }

}
