import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import express, {Express} from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import winston from 'winston';
import path from 'path';
import {GoogleAuthService} from '../../google/GoogleAuthService';
import {FileId} from '../../model/model';
import {MimeTypes} from '../../model/GoogleFile';
import {saveRunningInstance} from './loadRunningInstance';
import {AuthConfig} from '../../model/AccountJson';
import {urlToFolderId} from '../../utils/idParsers';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {DriveJobsMap, JobManagerContainer} from '../job/JobManagerContainer';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {expressjwt} from 'express-jwt';
import {fileURLToPath} from 'url';
import {googleMimeToExt} from '../transform/TaskLocalFileTransform';
import GitController from './routes/GitController';
import FolderController from './routes/FolderController';
import {ConfigController} from './routes/ConfigController';
import {DriveController} from './routes/DriveController';
import {BackLinksController} from './routes/BackLinksController';
import {GoogleDriveController} from './routes/GoogleDriveController';
import {LogsController} from './routes/LogsController';
import cookieParser from 'cookie-parser';

import {SocketManager} from './SocketManager';
import * as vite from 'vite';
import * as fs from 'fs';
import {authenticate, signToken} from './auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';

interface TreeItem {
  id: FileId;
  name: string;
  mimeType: string;
  children?: TreeItem[];
}

function generateTreePath(fileId: FileId, files: TreeItem[], fieldName: string, curPath = '') {
  for (const file of files) {
    const part = file[fieldName];

    if (file.id === fileId) {
      return [ file, curPath ? curPath + '/' + part : part ];
    }
  }

  for (const file of files) {
    if (file.mimeType !== MimeTypes.FOLDER_MIME) {
      continue;
    }

    const part = file[fieldName];

    if (file.children) {
      const tuple = generateTreePath(fileId, file.children, fieldName, curPath ? curPath + '/' + part : part);
      if (tuple?.length > 0) {
        return tuple;
      }
    }
  }

  return [];
}

export const isHtml = req => req.headers.accept.indexOf('text/html') > -1;
const extToMime = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.htm': 'text/html',
  '.html': 'text/html'
};

export class ServerContainer extends Container {
  private logger: winston.Logger;
  private app: Express;
  private authContainer: Container;
  private socketManager: SocketManager;

  constructor(params: ContainerConfig, private port: number) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
    this.authContainer = engine.getContainer('google_api');
    this.socketManager = new SocketManager(this.engine);
    await saveRunningInstance(this.port);
  }

  async destroy(): Promise<void> {
    // TODO
  }

  private async initUiServer(app) {
    const viteInstance = await vite.createServer({
      root: HTML_DIR,
      logLevel: 'info',
      appType: 'custom',
      server: {
        middlewareMode: true,
        watch: {
          // During tests we edit the files too fast and sometimes chokidar
          // misses change events, so enforce polling for consistency
          usePolling: true,
          interval: 100
        }
      }
    });
    app.use(viteInstance.middlewares);

    app.use((req, res) => {
      const indexHtml = fs.readFileSync(HTML_DIR + '/index.html')
        .toString()
        .replace(/GIT_SHA/g, process.env.GIT_SHA);
      res.status(404).header('Content-type', 'text/html').end(indexHtml);
    });
  }

  private async startServer(port) {
    const app = this.app = express();

    app.use(express.json());
    app.use(cookieParser());

    app.use((req, res, next) => {
      res.header('GIT_SHA', process.env.GIT_SHA);
      next();
    });

    await this.initRouter(app);
    await this.initAuth(app);

    await this.initUiServer(app);

    const server = http.createServer(app);

    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
      if (!req.url || !req.url.startsWith('/api/')) {
        return;
      }
      const parts = req.url.split('/');
      if (!parts[2]) {
        return;
      }
      this.socketManager.addSocketConnection(ws, parts[2]);
    });

    app.use((err, req, res, next) => {
      switch(err.status) {
        case 401:
          res.status(err.status).send({ message: err.message, authPath: err.authPath });
          return;
        default:
          console.error(err);
      }
      res.status(err.status).send(err.message);
    });

    server.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  async initAuth(app) {
    app.get('/auth/:driveId', async (req, res, next) => {
      try {
        const hostname = req.header('host');
        const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
        const serverUrl = protocol + hostname;
        const driveId = req.params.driveId;
        const redirectTo = req.query.redirectTo;

        const googleAuthService = new GoogleAuthService();
        const auth = await googleAuthService.authorizeUserAccount(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);

        const state = new URLSearchParams({
          driveId,
          redirectTo
        }).toString();

        const authUrl = await googleAuthService.getWebAuthUrl(auth, `${serverUrl}/auth`, state);

        res.redirect(authUrl);
      } catch (err) {
        next(err);
      }
    });

    app.get('/auth', async (req, res, next) => {
      try {
        const hostname = req.header('host');
        const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
        const serverUrl = protocol + hostname;

        if (!req.query.state) {
          throw new Error('No state query parameter');
        }
        const state = new URLSearchParams(req.query.state);
        const driveId = state.get('driveId');
        const redirectTo = state.get('redirectTo');

        const googleAuthService = new GoogleAuthService();
        const auth = await googleAuthService.authorizeUserAccount(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        const token = await googleAuthService.getWebToken(auth, `${serverUrl}/auth`, req.query.code);

        const auth2 = new OAuth2Client();
        auth2.setCredentials(token);

        const googleDriveService = new GoogleDriveService(this.logger);
        const drive = await googleDriveService.getDrive(auth2, driveId);

        if (drive.id) {
          const googleUser = await googleAuthService.getUser({ access_token: token.access_token });
          const accessToken = signToken(googleUser, driveId);
          res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: true
          });

          res.redirect(redirectTo);
          return;
        }

        res.json({});
      } catch (err) {
        next(err);
      }
    });

    app.post('/auth/gdrive', async (req, res, next) => {
      try {
        const driveId = req.data.driveId;
        if (!driveId) {
          throw new Error('No driveId');
        }

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });
  }

  async initRouter(app) {
    const driveController = new DriveController('/api/drive', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'));
    app.use('/api/drive', authenticate(), await driveController.getRouter());

    const gitController = new GitController('/api/git', this.filesService);
    app.use('/api/git', authenticate(), await gitController.getRouter());

    const folderController = new FolderController('/api/file', this.filesService, this.authContainer);
    app.use('/api/file', authenticate(), await folderController.getRouter());

    const googleDriveController = new GoogleDriveController('/api/gdrive', this.filesService, this.authContainer);
    app.use('/api/gdrive', authenticate(), await googleDriveController.getRouter());

    const backlinksController = new BackLinksController('/api/backlinks', this.filesService);
    app.use('/api/backlinks', authenticate(), await backlinksController.getRouter());

    const configController = new ConfigController('/api/config', this.filesService);
    app.use('/api/config', authenticate(), await configController.getRouter());

    const logsController = new LogsController('/api/logs', this.logger);
    app.use('/api/logs', authenticate(), await logsController.getRouter());

    app.get('/api/drive/:driveId/file/(:fileId).odt', authenticate(), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
        const driveTree = await driveFileSystem.readJson('.tree.json');
        if (driveTree) {
          const [file, drivePath] = generateTreePath(fileId, driveTree, 'id');
          if (file && drivePath) {
            const odtPath = drivePath + '.odt';
            if (await driveFileSystem.exists(odtPath)) {
              driveFileSystem.createReadStream(odtPath).pipe(res);
              return;
            }
          }
        }

        res.status(404).json({});
      } catch (err) {
        if (err.message === 'Drive not shared with wikigdrive') {
          const authConfig: AuthConfig = this.authContainer['authConfig'];
          res.status(404).json({ not_registered: true, share_email: authConfig.share_email });
          return;
        }
        next(err);
      }
    });

    app.get('/api/drive/:driveId/transformed/(:fileId)', authenticate(), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
        const driveTree = await driveFileSystem.readJson('.tree.json');
        if (driveTree) {
          const [file, drivePath] = generateTreePath(fileId, driveTree, 'id');

          if (file && drivePath) {
            const filePath = `${drivePath}.${googleMimeToExt(file.mimeType, '')}`;
            if (await driveFileSystem.exists(filePath)) {
              res.header('Content-Disposition', `attachment; filename="${file.name}.${googleMimeToExt(file.mimeType, '')}"`);
              driveFileSystem.createReadStream(filePath).pipe(res);
              return;
            }
          }
        }

        res.status(404).json({});
      } catch (err) {
        if (err.message === 'Drive not shared with wikigdrive') {
          const authConfig: AuthConfig = this.authContainer['authConfig'];
          res.status(404).json({ not_registered: true, share_email: authConfig.share_email });
          return;
        }
        next(err);
      }
    });


    app.get('/api/ps', async (req, res, next) => {
      try {
        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        const driveJobsMap: DriveJobsMap = await jobManagerContainer.ps();

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folders = await folderRegistryContainer.getFolders();

        const retVal = [];
        for (const folderId in folders) {
          const driveJobs = driveJobsMap[folderId] || { jobs: [] };
          const folder = folders[folderId];
          retVal.push({
            folderId, name: folder.name, jobs_count: driveJobs.jobs.length
          });
        }

        res.json(retVal);
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId', authenticate(), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'sync_all',
          title: 'Syncing all'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId/:fileId', authenticate(), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        let fileTitle = '#' + fileId;

        const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
        const driveTree = await driveFileSystem.readJson('.tree.json');
        if (driveTree) {
          const [file, drivePath] = generateTreePath(fileId, driveTree, 'id');
          if (file && drivePath) {
            fileTitle = file.name;
          }
        }

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'sync',
          payload: fileId,
          title: 'Syncing file: ' + fileTitle
        });

        res.json({ driveId, fileId });
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/inspect/:driveId', authenticate(), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        const inspected = await jobManagerContainer.inspect(driveId);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folders = await folderRegistryContainer.getFolders();
        inspected['folder'] = folders[driveId];

        res.json(inspected);
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/share_drive', async (req, res) => {
      const serverUrl = 'http://localhost:3000';
      const driveId = req.query.state;
      const code = req.query.code;

      const googleAuthService = new GoogleAuthService();
      const authConfig: AuthConfig = this.authContainer['authConfig'];
      const auth = await googleAuthService.authorizeUserAccount(authConfig.web_account.client_id, authConfig.web_account.client_secret);
      try {
        const google_auth = await googleAuthService.getWebToken(auth, serverUrl + '/api/share_drive', code);
        auth.setCredentials(google_auth);

        const googleDriveService = new GoogleDriveService(this.logger);
        await googleDriveService.shareDrive(auth, driveId, authConfig.share_email);

        res.json({
          driveId
        });
      } catch (err) {
        console.error(err);
      }
    });

    app.post('/api/share_drive', async (req, res, next) => {
      try {
        const folderUrl = req.body.url;
        const driveId = urlToFolderId(folderUrl);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        if (!driveId) {
          throw new Error('No DriveId');
        }
        const folder = await folderRegistryContainer.registerFolder(driveId);

        // const googleAuthService = new GoogleAuthService();
        // const authConfig: AuthConfig = this.authContainer['authConfig'];
        // const auth = await googleAuthService.authorizeUserAccount(authConfig.web_account.client_id, authConfig.web_account.client_secret);
        // const authUrl = await googleAuthService.getWebAuthUrl(auth, serverUrl + '/api/share_drive', driveId);
        // console.log('google_auth', authUrl);

        res.json(folder);
      } catch (err) {
        next(err);
      }
    });
  }

  async run() {
    await this.startServer(this.port);
  }

}
