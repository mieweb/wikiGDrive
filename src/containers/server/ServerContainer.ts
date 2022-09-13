import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import express, {Express, Request, Response, NextFunction} from 'express';
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
import {fileURLToPath} from 'url';
import {googleMimeToExt} from '../transform/TaskLocalFileTransform';
import GitController from './routes/GitController';
import FolderController from './routes/FolderController';
import {ConfigController} from './routes/ConfigController';
import {DriveController} from './routes/DriveController';
import {BackLinksController} from './routes/BackLinksController';
import {GoogleDriveController} from './routes/GoogleDriveController';
import {LogsController} from './routes/LogsController';
import {PreviewController} from './routes/PreviewController';
import cookieParser from 'cookie-parser';

import {SocketManager} from './SocketManager';
import * as vite from 'vite';
import * as fs from 'fs';
import {authenticate, AuthError, signToken} from './auth';
import {filterParams, GoogleDriveServiceError} from '../../google/driveFetch';
import {Logger} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';

interface TreeItem {
  id: FileId;
  name: string;
  mimeType: string;
  children?: TreeItem[];
}

function openerRedirect(res: Response, redirectTo: string) {
  res.send(`<script>window.opener.authenticated('${redirectTo}');window.close();</script>`);
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
    await this.socketManager.mount(this.filesService);
    await saveRunningInstance(this.port);
  }

  async destroy(): Promise<void> {
    // TODO
  }

  private async initUiServer(app) {
    const customLogger: Logger = {
      hasWarned: false,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      clearScreen() {},
      error: (msg: string) => {
        this.logger.error(msg);
      },
      hasErrorLogged: () => {
        return false;
      },
      info: (msg: string) => {
        this.logger.info(msg);
      },
      warn: (msg: string) => {
        this.logger.warn(msg);
      },
      warnOnce: (msg: string) => {
        this.logger.warn(msg);
      }
    };

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
      },
      customLogger: customLogger
    });
    app.use(viteInstance.middlewares);

    app.use((req: express.Request, res: express.Response) => {
      if (req.path.startsWith('/drive') || req.path.startsWith('/gdocs') || req.path.startsWith('/auth') || req.path === '/') {
        const indexHtml = fs.readFileSync(HTML_DIR + '/index.html')
          .toString()
          .replace(/GIT_SHA/g, process.env.GIT_SHA);
        res.status(200).header('Content-type', 'text/html').end(indexHtml);
      } else {
        res.status(404).json({});
      }
    });
  }

  private async startServer(port) {
    const app = this.app = express();

    app.use(express.json({
      limit: '50mb'
    }));
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

    app.use((err: GoogleDriveServiceError & AuthError, req: Request, res: Response, next: NextFunction) => {
      const code = err.status || 501;
      switch(code) {
        case 404:
          if (req.path.startsWith('/drive') || req.path.startsWith('/gdocs') || req.path.startsWith('/auth') || req.path === '/') {
            const indexHtml = fs.readFileSync(HTML_DIR + '/index.html')
              .toString()
              .replace(/GIT_SHA/g, process.env.GIT_SHA);
            res.status(404).header('Content-type', 'text/html').end(indexHtml);
          } else {
            res.status(code).send({ code, message: err.message });
          }
          return;
        case 401:
          if (req.headers['redirect-to']) {
            err.redirectTo = req.headers['redirect-to'].toString();
          } else {
            err.redirectTo = '/drive/' + req['driveId'];
          }
          if (req['driveId']) {
            err.authPath = '/auth/' + req['driveId'] + '?redirectTo=' + err.redirectTo;
          } else {
            err.authPath = '/auth/none?redirectTo=' + err.redirectTo;
          }
          res.status(code).send({ message: err.message, authPath: err.authPath });
          return;
        default:
          console.error(err);
      }

      res.header('Content-type', 'text/plain');
      res.status(code).send(err.message);
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

        const state = new URLSearchParams(filterParams({
          driveId: driveId !== 'none' ? driveId : undefined,
          redirectTo
        })).toString();

        const authUrl = await googleAuthService.getWebAuthUrl(process.env.GOOGLE_AUTH_CLIENT_ID, `${serverUrl}/auth`, state);

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

        if (!req.query.not_popup) {
          openerRedirect(res, req.url + '&not_popup=1');
          return;
        }

        if (!req.query.state) {
          throw new Error('No state query parameter');
        }
        const state = new URLSearchParams(req.query.state);
        const driveId = state.get('driveId');
        const redirectTo = state.get('redirectTo');

        const googleAuthService = new GoogleAuthService();
        const token = await googleAuthService.getWebToken(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET, `${serverUrl}/auth`, req.query.code);
        const googleUserAuth = await googleAuthService.authorizeUserAccount(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        googleUserAuth.setCredentials(token);

        const googleDriveService = new GoogleDriveService(this.logger);
        const googleUser = await googleAuthService.getUser({ access_token: token.access_token });

        if (driveId) {
          const drive = await googleDriveService.getDrive(googleUserAuth, driveId);
          if (drive.id) {
            const accessToken = signToken(googleUser, driveId);
            res.cookie('accessToken', accessToken, {
              httpOnly: true,
              secure: true,
              sameSite: 'none'
            });
            res.redirect(redirectTo || '/');
            return;
          }
        } else {
          const accessToken = signToken(googleUser, '');
          res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none'
          });
          res.redirect(redirectTo || '/');
          return;
        }

        res.json({});
      } catch (err) {
        if (err.message.indexOf('invalid_grant') > -1) {
          if (req.query.state) {
            const state = new URLSearchParams(req.query.state);
            const redirectTo = state.get('redirectTo');
            res.redirect(redirectTo || '/');
          } else {
            res.redirect('/');
          }
          return;
        }
        next(err);
      }
    });
  }

  async initRouter(app) {
    const driveController = new DriveController('/api/drive', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'));
    app.use('/api/drive', authenticate(this.logger), await driveController.getRouter());

    const gitController = new GitController('/api/git', this.filesService);
    app.use('/api/git', authenticate(this.logger), await gitController.getRouter());

    const folderController = new FolderController('/api/file', this.filesService, this.authContainer);
    app.use('/api/file', authenticate(this.logger), await folderController.getRouter());

    const googleDriveController = new GoogleDriveController('/api/gdrive', this.filesService, this.authContainer);
    app.use('/api/gdrive', authenticate(this.logger), await googleDriveController.getRouter());

    const backlinksController = new BackLinksController('/api/backlinks', this.filesService);
    app.use('/api/backlinks', authenticate(this.logger), await backlinksController.getRouter());

    const configController = new ConfigController('/api/config', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'));
    app.use('/api/config', authenticate(this.logger), await configController.getRouter());

    const logsController = new LogsController('/api/logs', this.logger);
    app.use('/api/logs', authenticate(this.logger), await logsController.getRouter());

    const previewController = new PreviewController('/preview', this.logger);
    app.use('/preview', authenticate(this.logger), await previewController.getRouter());

    app.get('/api/drive/:driveId/file/(:fileId).odt', authenticate(this.logger, 2), async (req, res, next) => {
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

    app.get('/api/drive/:driveId/transformed/(:fileId)', authenticate(this.logger, 2), async (req, res, next) => {
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

    app.post('/api/render_preview/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'render_preview',
          title: 'Render preview'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/transform/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'transform',
          title: 'Transform Markdown'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/transform/:driveId/:fileId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'transform',
          payload: fileId,
          title: 'Transform Single'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'sync_all',
          title: 'Syncing all'
        });
        await jobManagerContainer.schedule(driveId, {
          type: 'transform',
          title: 'Transform markdown'
        });
        await jobManagerContainer.schedule(driveId, {
          type: 'render_preview',
          title: 'Render preview'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId/:fileId', authenticate(this.logger, 2), async (req, res, next) => {
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
        await jobManagerContainer.schedule(driveId, {
          type: 'transform',
          payload: fileId,
          title: 'Transform markdown'
        });
        await jobManagerContainer.schedule(driveId, {
          type: 'render_preview',
          title: 'Render preview'
        });

        res.json({ driveId, fileId });
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/inspect/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
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

    app.post('/api/share_drive', authenticate(this.logger, -1), async (req, res, next) => {
      try {
        const folderUrl = req.body.url;
        const driveId = urlToFolderId(folderUrl);

        if (!driveId) {
          throw new Error('No DriveId');
        }

        const googleDriveService = new GoogleDriveService(this.logger);
        const googleAuthService = new GoogleAuthService();
        const googleUserAuth = await googleAuthService.authorizeUserAccount(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        googleUserAuth.setCredentials({ access_token: req.user.google_access_token });

        const drive = await googleDriveService.getDrive(googleUserAuth, driveId);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folder = await folderRegistryContainer.registerFolder(drive.id);

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
