import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import express, {Express} from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import {GoogleAuthService} from '../../google/GoogleAuthService';
import {GoogleFilesScanner} from '../transform/GoogleFilesScanner';
import {DirectoryScanner} from '../transform/DirectoryScanner';
import {FileId} from '../../model/model';
import {MimeTypes} from '../../model/GoogleFile';
import {saveRunningInstance} from './loadRunningInstance';
import {AuthConfig} from '../../model/AccountJson';
import {urlToFolderId} from '../../utils/idParsers';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {DriveJobsMap, JobManagerContainer} from '../job/JobManagerContainer';
import {GitScanner} from '../../git/GitScanner';

import {fileURLToPath} from 'url';
import {LocalLinks} from '../transform/LocalLinks';
import {UserConfigService} from '../google_folder/UserConfigService';
import {googleMimeToExt} from '../transform/TaskLocalFileTransform';
import {boolean} from 'casual';
import {Controller, useController} from './routes/Controller';
import GitController from './routes/GitController';
import FolderController from './routes/FolderController';
import {ConfigController} from './routes/ConfigController';
import {DriveController} from './routes/DriveController';
import {BackLinksController} from './routes/BackLinksController';
import {GoogleDriveController} from './routes/GoogleDriveController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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


type CallBack = (treeItem: TreeItem) => boolean;

function generateTreePathCallback(callBack: CallBack, files: TreeItem[], fieldName: string, curPath = '') {
  for (const file of files) {
    const part = file[fieldName];

    if (callBack(file)) {
      return [ file, curPath ? curPath + '/' + part : part ];
    }
  }

  for (const file of files) {
    if (file.mimeType !== MimeTypes.FOLDER_MIME) {
      continue;
    }

    const part = file[fieldName];

    if (file.children) {
      const tuple = generateTreePathCallback(callBack, file.children, fieldName, curPath ? curPath + '/' + part : part);
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

  constructor(params: ContainerConfig, private port: number) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
    this.authContainer = engine.getContainer('google_api');
    await saveRunningInstance(this.port);
  }

  async destroy(): Promise<void> {
    // TODO
  }

  private async startServer(port) {
    const app = this.app = express();
    app.use(express.json());

    app.use(express.static(__dirname + '/static'));

    await this.initRouter(app);

    app.use((req, res, next) => {
      res.header('GIT_SHA', process.env.GIT_SHA);
      next();
    });

    await useController(app, '/drive', import('./routes/HtmlController'));
    await useController(app, '/gdocs', import('./routes/HtmlController'));

    app.use((req, res) => {
      const indexHtml = fs.readFileSync(__dirname + '/static/index.html')
        .toString()
        .replace(/GIT_SHA/g, process.env.GIT_SHA);

      res.status(404).header('Content-type', 'text/html').end(indexHtml);
      // res.status(404).send('Sorry can\'t find that!');
    });

    const server = http.createServer(app);

    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
      ws.on('message', (data) => {
        ws.send('test_response:' + req.url + ':' + data);
      });
    });

    server.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  async initRouter(app) {
    const driveController = new DriveController('/api/drive', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'));
    app.use('/api/drive', await driveController.getRouter());

    const gitController = new GitController('/api/git', this.filesService);
    app.use('/api/git', await gitController.getRouter());

    const folderController = new FolderController('/api/file', this.filesService, this.authContainer);
    app.use('/api/file', await folderController.getRouter());

    const googleDriveController = new GoogleDriveController('/api/gdrive', this.filesService, this.authContainer);
    app.use('/api/gdrive', await googleDriveController.getRouter());

    const backlinksController = new BackLinksController('/api/backlinks', this.filesService, this.authContainer);
    app.use('/api/backlinks', await backlinksController.getRouter());

    const configController = new ConfigController('/api/config', this.filesService);
    app.use('/api/config', await configController.getRouter());

    app.get('/api/drive/:driveId/file/(:fileId).odt', async (req, res, next) => {
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

    app.get('/api/drive/:driveId/transformed/(:fileId)', async (req, res, next) => {
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

    app.post('/api/sync/:driveId', async (req, res, next) => {
      try {
        const driveId = req.params.driveId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'sync_all'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId/:fileId', async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          type: 'sync', payload: fileId
        });

        res.json({ driveId, fileId });
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/inspect/:driveId', async (req, res, next) => {
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

        // const googleAuthService = new GoogleAuthService();
        // const authConfig: AuthConfig = this.authContainer['authConfig'];
        // const auth = await googleAuthService.authorizeUserAccount(authConfig.web_account.client_id, authConfig.web_account.client_secret);
        // const authUrl = await googleAuthService.getWebAuthUrl(auth, serverUrl + '/api/share_drive', driveId);
        // console.log('google_auth', authUrl);

        res.json({ drive_id: driveId });
      } catch (err) {
        next(err);
      }
    });
  }

 /*
    app.get('/logs', (req, res, next) => {
      if (isHtml(req)) {
        return res.render('index.html', { title: 'wikigdrive' });
      }

      const options: QueryOptions = {
        from: new Date(+new Date() - (24 * 60 * 60 * 1000)),
        until: new Date(),
        limit: 100,
        start: 0,
        order: 'desc',
        fields: undefined//['message']
      };

      this.logger.query(options, (err, results) => {
        if (err) {
          return next(err);
        }
        res.json(results);
      });
    });
*/

  async run() {
    await this.startServer(this.port);
  }

  getServer() {
    return this.app;
  }
}
