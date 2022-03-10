import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import * as express from 'express';
import * as winston from 'winston';
import {Express} from 'express';
import * as path from 'path';
import * as fs from 'fs';
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
      if (tuple) {
        return tuple;
      }
    }
  }

  return '';
}

const isHtml = req => req.headers.accept.indexOf('text/html') > -1;
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

  private startServer(port) {
    const app = this.app = express();
    app.use(express.json());

/*    const env = nunjucks.configure([__dirname + '/templates/'], { // set folders with templates
      autoescape: true,
      express: app
    });*/

    app.use(express.static(__dirname + '/static'));

    this.initRouter(app);

    const indexHandler = (req, res, next) => {
      const indexHtml = fs.readFileSync(__dirname + '/static/index.html');
      res.header('Content-type', 'text/html').end(indexHtml);
    };

    app.get('/drive/:driveId', indexHandler);
    app.get('/drive/:driveId/file/:fileId', indexHandler);

    app.use((req, res, next) => {
      const indexHtml = fs.readFileSync(__dirname + '/static/index.html');
      res.status(404).header('Content-type', 'text/html').end(indexHtml);
      // res.status(404).send('Sorry can\'t find that!');
    });

    app.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  tryOutput(res, filename) {
    if (fs.existsSync(filename)) {
      console.log(filename);
      const stat = fs.statSync(filename);
      if (stat.isFile()) {
        res.setHeader('content-type', extToMime[path.extname(filename)] || 'text/plain');
        fs.createReadStream(filename).pipe(res);
        return true;
      }
    }
  }

  initRouter(app) {
    const folderHandler = async (req, res, next) => {
      let drive;
      let rootFolder;
      try {
        const driveId = req.params.driveId;
        const folderId = req.params.folderId;

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        rootFolder = await folderRegistryContainer.registerFolder(driveId);

        let transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
        let parentId = '';
        let markdownPath = '';
        if (folderId) {
          const transformedTree = await transformedFileSystem.readJson('.tree.json');
          const [file, transformPath] = generateTreePath(folderId, transformedTree, 'name');
          parentId = file.parentId || driveId;
          if (transformPath) {
            transformedFileSystem = await transformedFileSystem.getSubFileService(transformPath, '');
          }
          markdownPath = transformPath;
        }

        let driveFileSystem = await this.filesService.getSubFileService(driveId);
        drive = await driveFileSystem.readJson('.drive.json');
        if (folderId) {
          const driveTree = await driveFileSystem.readJson('.tree.json');
          const [file, drivePath] = generateTreePath(folderId, driveTree, 'id');
          if (drivePath) {
            driveFileSystem = await driveFileSystem.getSubFileService(drivePath);
          }
        }

        const directoryScanner = new DirectoryScanner();
        const localFiles = Object.values(await directoryScanner.scan(transformedFileSystem));

        const scanner = new GoogleFilesScanner();
        const googleFiles = await scanner.scan(driveFileSystem);

        googleFiles.sort((file1, file2) => {
          if ((MimeTypes.FOLDER_MIME === file1.mimeType) && !(MimeTypes.FOLDER_MIME === file2.mimeType)) {
            return -1;
          }
          if (!(MimeTypes.FOLDER_MIME === file1.mimeType) && (MimeTypes.FOLDER_MIME === file2.mimeType)) {
            return 1;
          }
          return file1.name.toLocaleLowerCase().localeCompare(file2.name.toLocaleLowerCase());
        });

        const retVal = {};
        for (const file of googleFiles) {
          retVal[file.id] = {
            google: file,
            local: localFiles.find(lf => lf.id === file.id),
          };
        }

        const files = Object.values(retVal);

        // const files = await driveFileSystem.list();
        res.json({ rootFolder, drive, driveId, folderId, files, parentId, markdownPath });
      } catch (err) {
        if (err.message === 'Drive not shared with wikigdrive' || err.message.indexOf('Error download fileId') === 0) {
          const authConfig: AuthConfig = this.authContainer['authConfig'];
          res.status(404).json({ not_registered: true, share_email: authConfig.share_email, rootFolder });
          return;
        }
        next(err);
      }
    };

    app.get('/api/drive/:driveId', folderHandler);
    app.get('/api/drive/:driveId/folder/:folderId', folderHandler);

    app.post('/api/drive/:driveId/git/push', async (req, res, next) => {
      const driveId = req.params.driveId;
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(transformedFileSystem.getRealPath());
      await gitScanner.push();

      res.json({});
    });

    app.post('/api/drive/:driveId/git/commit', async (req, res, next) => {
      const driveId = req.params.driveId;
      const fileId = req.body.fileId;
      const message = req.body.message;

      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(transformedFileSystem.getRealPath());

      const transformedTree = await transformedFileSystem.readJson('.tree.json');
      const [file, transformPath] = generateTreePath(fileId, transformedTree, 'name');

      await gitScanner.commit(message, transformPath);

      res.json({});
    });

    app.put('/api/drive/:driveId/git', async (req, res, next) => {
      const driveId = req.params.driveId;
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

      const gitScanner = new GitScanner(transformedFileSystem.getRealPath());
      await gitScanner.initialize();

      if (req.body.remote_url) {
        await gitScanner.setRemoteUrl(req.body.remote_url);
      }
      res.json({});
    });

    app.get('/api/drive/:driveId/file/:fileId', async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const fileId = req.params.fileId;

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const drive = await folderRegistryContainer.registerFolder(driveId);

        const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
        const transformedTree = await transformedFileSystem.readJson('.tree.json');
        if (!Array.isArray(transformedTree)) {
          res.json({
            not_synced: true
          });
          return;
        }
        const [file, transformPath] = generateTreePath(fileId, transformedTree, 'name');

        const buffer = await transformedFileSystem.readBuffer(file.name);

        const gitScanner = new GitScanner(transformedFileSystem.getRealPath());
        const git = {
          initialized: await gitScanner.isRepo(),
          history: null,
          public_key: null,
          remote_url: null
        };

        if (git.initialized) {
          git.history = await gitScanner.history(transformPath);
          git.public_key = await gitScanner.getDeployKey();
          git.remote_url = await gitScanner.getRemoteUrl();
        }

        // parentId = file.parentId || driveId;
        // if (transformPath) {
        //   transformedFileSystem = await transformedFileSystem.getSubFileService(transformPath);
        // }
        // markdownPath = transformPath;
        res.json({
          driveId, fileId, mimeType: file.mimeType, transformPath, content: buffer.toString(),
          git
        });
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

    app.post('/api/drive/:driveId/sync/:fileId', async (req, res, next) => {
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

    app.get('/api/drive/:driveId/inspect', async (req, res, next) => {
      try {
        const driveId = req.params.driveId;
        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        const inspected = await jobManagerContainer.inspect(driveId);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folders = await folderRegistryContainer.getFolders();
        const folder = folders[driveId];
        inspected['folder'] = folder;

        res.json(inspected);
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/drive/:driveId/sync', async (req, res, next) => {
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

        const result = await googleDriveService.shareDrive(auth, driveId, authConfig.share_email);
      } catch (err) {
        console.error(err);
      }
    });

    app.post('/api/share_drive', async (req, res) => {
      const serverUrl = 'http://localhost:3000';

      const folderUrl = req.body.url;
      const driveId = urlToFolderId(folderUrl);

      // const googleAuthService = new GoogleAuthService();
      // const authConfig: AuthConfig = this.authContainer['authConfig'];
      // const auth = await googleAuthService.authorizeUserAccount(authConfig.web_account.client_id, authConfig.web_account.client_secret);
      // const authUrl = await googleAuthService.getWebAuthUrl(auth, serverUrl + '/api/share_drive', driveId);
      // console.log('google_auth', authUrl);

      res.json({ drive_id: driveId });
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
