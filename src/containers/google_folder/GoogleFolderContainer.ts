import {Container, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {Router} from 'express';
import {GoogleDriveService, ListContext} from '../../google/GoogleDriveService';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {QueueDownloader} from './QueueDownloader';
import {TaskFetchFolder} from './TaskFetchFolder';
import {MimeTypes} from '../../model/GoogleFile';

export class GoogleFolderContainer extends Container {
  private logger: winston.Logger;
  private googleDriveService: GoogleDriveService;
  private auth: OAuth2Client;
  private drive_id: string;

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
    this.googleDriveService = new GoogleDriveService(this.logger);
    const googleApiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
    this.auth = googleApiContainer.getAuth();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async getRouter(): Promise<Router> {
    const router = Router();
    router.get('/', ((req, res) => {
      res.json({'test': 1});
    }));
    return router;
  }

  async run() {
    const downloader = new QueueDownloader(this.logger);

    switch (this.params.cmd) {
      case 'pull':
        downloader.addTask(new TaskFetchFolder(
          this.logger,
          this.googleDriveService,
          this.auth,
          this.googleFilesService,
        { id: this.params.folderId, name: this.params.folderId, mimeType: MimeTypes.FOLDER_MIME }
        ));
    }

    await downloader.finished();
  }

}
