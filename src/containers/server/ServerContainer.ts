import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import express, {Express, NextFunction, Request, Response} from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import winston from 'winston';
import path from 'path';
import {FileId} from '../../model/model';
import {saveRunningInstance} from './loadRunningInstance';
import {urlToFolderId} from '../../utils/idParsers';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {DriveJobsMap, JobManagerContainer} from '../job/JobManagerContainer';
import {fileURLToPath} from 'url';
import GitController from './routes/GitController';
import FolderController from './routes/FolderController';
import {ConfigController} from './routes/ConfigController';
import {DriveController} from './routes/DriveController';
import {BackLinksController} from './routes/BackLinksController';
import {GoogleDriveController} from './routes/GoogleDriveController';
import {LogsController} from './routes/LogsController';
import {PreviewController} from './routes/PreviewController';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import {SocketManager} from './SocketManager';
import * as vite from 'vite';
import {Logger} from 'vite';
import * as fs from 'fs';
import {authenticate, AuthError, GoogleUser, getAuth, setAccessCookie, signToken} from './auth';
import {filterParams, GoogleDriveServiceError} from '../../google/driveFetch';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor';
import {SearchController} from './routes/SearchController';
import opentelemetry from '@opentelemetry/api';
import {DriveUiController} from './routes/DriveUiController';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {UserAuthClient} from '../../google/AuthClient';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';

interface TreeItem {
  id: FileId;
  name: string;
  mimeType: string;
  children?: TreeItem[];
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
    this.app.set('viteInstance', viteInstance);
    app.use(viteInstance.middlewares);
  }

  private async handleStaticHtml(reqPath: string, url: string) {
    if (reqPath.startsWith('/drive') || reqPath.startsWith('/gdocs') || reqPath.startsWith('/auth') || reqPath === '/' || reqPath.startsWith('/share-drive')) {
      const distPath = path.resolve(HTML_DIR, 'dist');
      if (fs.existsSync(distPath)) {
        const template = fs.readFileSync(path.join(distPath, 'index.html'));
        return template;
      } else {
        const template = fs.readFileSync(HTML_DIR + '/index.html')
          .toString()
          .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
          .replace(/GIT_SHA/g, process.env.GIT_SHA);

        const viteInstance = this.app.get('viteInstance');

        return await viteInstance.transformIndexHtml(url, template);
      }
    }
    return null;
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

    if (process.env.ZIPKIN_URL) {
      app.use((req, res, next) => {
        if (req.header('traceparent')) {
          next();
          return;
        }

        const span = opentelemetry.trace.getActiveSpan();
        if (span) {
          const traceId = span.spanContext().traceId;
          res.header('trace-id', traceId);
        }
        next();
      });
    }

    app.use(rateLimit({
      windowMs: 60 * 1000,
      max: 3000
    }));

    app.use((req: express.Request, res: express.Response, next: NextFunction) => {
      res.header('wgd-is-logged', req.cookies['accessToken'] ? '1' : '');
      next();
    });

    await this.initRouter(app);
    await this.initAuth(app);

    const distPath = path.resolve(HTML_DIR, 'dist');
    app.use(express.static(distPath));
    await this.initUiServer(app);

    app.use(async (req: express.Request, res: express.Response) => {
      const indexHtml = await this.handleStaticHtml(req.path, req.originalUrl);
      if (indexHtml) {
        res.status(200).header('Content-type', 'text/html').end(indexHtml);
      } else {
        res.status(404).json({});
      }
    });

    app.use(async (err: GoogleDriveServiceError & AuthError, req: Request, res: Response, next: NextFunction) => {
      const code = err.status || 501;
      res.header('wgd-share-email', this.params.share_email || '');
      switch(code) {
        case 404:
          {
            const indexHtml = await this.handleStaticHtml(req.path, req.originalUrl);
            if (indexHtml) {
              res.status(404).header('Content-type', 'text/html').end(indexHtml);
            } else {
              res.status(code).send({ code, message: err.message });
            }
          }
          return;
        case 401:
          if (req.headers['redirect-to']) {
            err.redirectTo = req.headers['redirect-to'].toString();
          } else {
            err.redirectTo = '/drive/' + req['driveId'];
          }
          console.error(err);
          if (req['driveId']) {
            err.authPath = '/auth/' + req['driveId'] + '?redirectTo=' + err.redirectTo;
          } else {
            err.authPath = '/auth/none?redirectTo=' + err.redirectTo;
          }
          if (process.env.VERSION === 'dev') {
            console.error(err);
            console.trace();
            console.debug('app.use 401');
            console.debug('  req[\'driveId\']', req['driveId']);
            console.debug('  req.headers[\'redirect-to\']', req.headers['redirect-to']);
            console.debug('  err.redirectTo', err.redirectTo);
            console.debug('  err.authPath', err.authPath);
          }
          res.status(code).send({ message: err.message, authPath: err.authPath, stack: err.stack });
          return;
        default:
          console.error(err);
      }

      res.header('Content-type', 'application/json');
      res.status(code).send({ message: err.message });

      next();
    });

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

    server.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  async initAuth(app) {
    app.post('/auth/logout', async (req, res, next) => {
      res.clearCookie('accessToken');
      res.json({ loggedOut: true });
    });
    app.get('/auth/:driveId', async (req, res, next) => {
      try {
        const hostname = req.header('host');
        const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
        const serverUrl = protocol + hostname;
        const driveId = req.params.driveId;
        const redirectTo = req.query.redirectTo;

        const state = new URLSearchParams(filterParams({
          driveId: driveId !== 'none' ? (driveId || '') : '',
          redirectTo
        })).toString();

        const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        const authUrl = await authClient.getWebAuthUrl(`${serverUrl}/auth`, state);
        if (process.env.VERSION === 'dev') {
          console.debug(authUrl);
        }

        res.redirect(authUrl);
      } catch (err) {
        next(err);
      }
    });

    app.get('/auth', (...args) => {
      getAuth.call(this, ...args);
    });
  }

  async initRouter(app) {
    const driveController = new DriveController('/api/drive', this.filesService,
      <FolderRegistryContainer>this.engine.getContainer('folder_registry'), this.authContainer);
    app.use('/api/drive', authenticate(this.logger), await driveController.getRouter());

    const gitController = new GitController('/api/git', this.filesService,
      <JobManagerContainer>this.engine.getContainer('job_manager'), this.engine);
    app.use('/api/git', authenticate(this.logger), await gitController.getRouter());

    const folderController = new FolderController('/api/file', this.filesService);
    app.use('/api/file', authenticate(this.logger), await folderController.getRouter());

    const googleDriveController = new GoogleDriveController('/api/gdrive', this.filesService, this.authContainer);
    app.use('/api/gdrive', authenticate(this.logger), await googleDriveController.getRouter());

    const backlinksController = new BackLinksController('/api/backlinks', this.filesService);
    app.use('/api/backlinks', authenticate(this.logger), await backlinksController.getRouter());

    const configController = new ConfigController('/api/config', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'));
    app.use('/api/config', authenticate(this.logger), await configController.getRouter());

    const logsController = new LogsController('/api/logs', this.logger);
    app.use('/api/logs', authenticate(this.logger), await logsController.getRouter());

    const searchController = new SearchController('/api/search', this.filesService);
    app.use('/api/search', authenticate(this.logger), await searchController.getRouter());

    const previewController = new PreviewController('/preview', this.logger);
    app.use('/preview', authenticate(this.logger), await previewController.getRouter());

    const driveUiController = new DriveUiController('/driveui', this.logger, this.filesService, <GoogleApiContainer>this.authContainer);
    app.use('/driveui', await driveUiController.getRouter());

    app.use('/api/share-token', authenticate(this.logger), (req, res) => {
      if ('POST' !== req.method) {
        throw new Error('Incorrect method');
      }
      if (req.user) {
        const { google_access_token } = req.user;
        if (google_access_token) {
          res.json({ google_access_token, share_email: this.params.share_email });
          return;
        }
      }
      res.json({});
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

    app.post('/api/run_action/:driveId/:trigger', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'run_action',
          title: 'Run action',
          trigger: req.params.trigger,
          payload: req.body ? JSON.stringify(req.body) : '',
          user: req.user
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
        const markdownTreeProcessor = new MarkdownTreeProcessor(driveFileSystem);
        await markdownTreeProcessor.load();
        const [file, drivePath] = await markdownTreeProcessor.findById(fileId);
        if (file && drivePath) {
          fileTitle = file['name'];
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

        const googleDriveService = new GoogleDriveService(this.logger, null);
        const drive = await googleDriveService.getDrive(req.user.google_access_token, driveId);

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
