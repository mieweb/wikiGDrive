import winston from 'winston';

import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine.ts';
import {QuotaLimiter} from '../../google/QuotaLimiter.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {AuthConfig} from '../../model/AccountJson.ts';
import {Drive, Permission} from '../folder_registry/FolderRegistryContainer.ts';
import {FileId} from '../../model/model.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {GoogleAuth, HasAccessToken, UserAuthClient, ServiceAuthClient, getCliCode} from '../../google/AuthClient.ts';

import {AuthError} from '../server/auth.ts';

const __filename = import.meta.filename;

export class GoogleApiContainer extends Container {
  private logger: winston.Logger;
  private oldSave: string;
  private auth: HasAccessToken;
  private quotaLimiter: QuotaLimiter;

  constructor(public readonly params: ContainerConfig, public authConfig: AuthConfig) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    const initial_quota_jobs = await this.filesService.readJson('quota.json') || [];
    this.quotaLimiter = new QuotaLimiter(initial_quota_jobs, this.logger);
    this.quotaLimiter.setInitialLimit(95, 10); // 950, 100 doesn't work as expected
    this.quotaLimiter.setSaveHandler(async (jobs) => {
      const str = JSON.stringify(jobs);
      if (this.oldSave === str) {
        return;
      }

      await this.filesService.writeJson('quota.json', jobs);
      this.oldSave = str;
    });

    if (this.authConfig.service_account) {
      this.auth = new ServiceAuthClient(this.authConfig.service_account);
    }
    if (this.authConfig.user_account) {
      const authClient = new UserAuthClient(this.authConfig.user_account.client_id, this.authConfig.user_account.client_secret);

      const google_auth: GoogleAuth = await this.filesService.readJson('auth_token.json');
      if (google_auth) {
        authClient.setCredentials(google_auth);
      } else {
        const code = await getCliCode(this.authConfig.user_account.client_id);
        const google_auth = await authClient.authorizeResponseCode(code, 'urn:ietf:wg:oauth:2.0:oob');
        await this.filesService.writeJson('auth_token.json', google_auth);
      }

      await authClient.authorizeUserAccount();

      this.auth = authClient;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async listDrives(): Promise<Drive[]> {
    if (!this.auth) {
      throw new AuthError('Not authenticated', 401);
    }

    const googleDriveService = new GoogleDriveService(this.logger, this.quotaLimiter);
    const accessToken = await this.auth.getAccessToken();
    return await googleDriveService.listDrives(accessToken);
  }

  async getDrive(driveId: FileId): Promise<Drive> {
    if (!this.auth) {
      throw new AuthError('Not authenticated', 401);
    }

    const googleDriveService = new GoogleDriveService(this.logger, this.quotaLimiter);
    const accessToken = await this.auth.getAccessToken();
    return await googleDriveService.getDrive(accessToken, driveId);
  }

  async getFolder(fileId: FileId): Promise<GoogleFile> {
    if (!this.auth) {
      throw new AuthError('Not authenticated', 401);
    }

    const googleDriveService = new GoogleDriveService(this.logger, this.quotaLimiter);
    return await googleDriveService.getFile(this.auth, fileId);
  }

  async shareDrive(driveId: string, shareEmail: string): Promise<Permission> {
    if (!this.auth) {
      throw new AuthError('Not authenticated', 401);
    }

    const googleDriveService = new GoogleDriveService(this.logger, this.quotaLimiter);
    const accessToken = await this.auth.getAccessToken();
    return await googleDriveService.shareDrive(accessToken, driveId, shareEmail);
  }

  getAuth(): HasAccessToken {
    return this.auth;
  }

  getQuotaLimiter() {
    return this.quotaLimiter;
  }
}
