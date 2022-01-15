'use strict';

import * as express from 'express';
import * as nunjucks from 'nunjucks';
import * as path from 'path';
import * as fs from 'fs';
import {Express} from 'express';
import {BasePlugin} from '../BasePlugin';
import {CliParams} from '../../MainService';
import {GoogleFilesStorage} from '../../storage/GoogleFilesStorage';
import {QueryOptions} from 'winston';
import {LocalFile, LocalFilesStorage} from '../../storage/LocalFilesStorage';
import {DownloadFilesStorage} from '../../storage/DownloadFilesStorage';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {DriveConfig} from '../StoragePlugin';
import * as SimpleGit from 'simple-git/promise';

const isHtml = req => req.headers.accept.indexOf('text/html') > -1;

export class ServerPlugin extends BasePlugin {
  private app: Express;
  private googleFilesStorage: GoogleFilesStorage;
  private localFilesStorage: LocalFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private googleDriveService: GoogleDriveService;
  private auth: any;
  private drive_config: DriveConfig;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({filename: __filename}));

    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('local_files:initialized', ({ localFilesStorage }) => {
      this.localFilesStorage = localFilesStorage;
    });
    eventBus.on('download_files:initialized', ({ downloadFilesStorage }) => {
      this.downloadFilesStorage = downloadFilesStorage;
    });
    eventBus.on('google_api:done', ({ auth }) => {
      this.auth = auth;
      const googleDriveService = new GoogleDriveService(this.eventBus, this.logger);
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });

    eventBus.on('main:run', async (params: CliParams) => {
      this.eventBus.emit('server:initialized');
      if (params.server_port) {
        this.startServer(params.server_port);
      }
    });
  }

  private startServer(port = 3000) {
    const app = this.app = express();

    const env = nunjucks.configure([__dirname + '/templates/'], { // set folders with templates
      autoescape: true,
      express: app
    });

    app.use(express.static(__dirname + '/assets'));

    this.initRouter(app);

    app.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  async loadGenerated(localFile: LocalFile) {
    const targetPath = path.join(this.drive_config.dest, ...localFile.localPath.substr(1).split('/'));
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    return fs.readFileSync(targetPath).toString();
  }

  initRouter(app) {
    app.get('/', (req, res) => {
      res.render('index.html', { title: 'wikigdrive' });
    });

    app.get('/file/:id', async (req, res) => {
      const fileId: string = req.params.id;

      if (isHtml(req)) {
        return res.render('file.html', { title: 'wikigdrive' });
      }

      const google = this.googleFilesStorage.findFile(item => item.id === fileId);
      const local = this.localFilesStorage.findFile(item => item.id === fileId);
      const downloaded = this.downloadFilesStorage.findFile(item => item.id === fileId);

      const api = await this.googleDriveService.getFile(this.auth, fileId);
      const parents = [];
      if (Array.isArray(api?.parents)) {
        for (const parentId of api?.parents) {
          parents.push(await this.googleDriveService.getFile(this.auth, parentId));
        }
      }

      const markdown = await this.loadGenerated(local);

      const repository = SimpleGit(this.drive_config.dest);
      const isRepo = await repository.checkIsRepo();

      const git = {
        dir: this.drive_config.dest,
        initialized: isRepo,
        status: null
      };

      if (isRepo) {
        const status = await repository.status();
        git.status = 'Ok';
        status.not_added = status.not_added.map(f => '/' + f);
        status.modified = status.modified.map(f => '/' + f);

        if (status.not_added.indexOf(local.localPath) > -1) {
          git.status = 'Not added';
        }
        if (status.modified.indexOf(local.localPath) > -1) {
          git.status = 'Modified';
        }
      }
/*
      if (!foundFile) {
        return res.status(404).send('Not found.');
      }
*/

      res.json({
        google, local, downloaded, api, parents, markdown, git
      });
    });

    app.post('/file/:id/mark_dirty', async (req, res, next) => {
      try {
        const fileId: string = req.params.id;
        this.logger.info('mark_dirty ' + fileId);
        await this.googleFilesStorage.removeFile(fileId);

        this.eventBus.emit('sync:run');

        res.json({});
      } catch (err) {
        next(err);
      }
    });

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
  }
}
