import {Container, ContainerEngine} from '../../ContainerEngine';
import * as express from 'express';
import * as winston from 'winston';
import {Express} from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {LocalFile} from '../../model/LocalFile';

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

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
  }

  async destroy(): Promise<void> {
    // TODO
  }

  private startServer(port = 3000) {
    const app = this.app = express();

/*    const env = nunjucks.configure([__dirname + '/templates/'], { // set folders with templates
      autoescape: true,
      express: app
    });*/

    app.use(express.static(__dirname + '/static'));

    this.initRouter(app);

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
/*    app.use((req: express.Request, res) => {
      const url = new URL(req.url, 'http://localhost:' + 3000);
      console.log(path.join(__dirname, 'static', url.pathname));
      if (this.tryOutput(res, path.join(__dirname, 'static', url.pathname))) {
        return;
      }
      if (this.tryOutput(res, path.join(__dirname, 'static', url.pathname, 'index.html'))) {
        return;
      }
      res.end('aaa');
      // res.render('index.html', { title: 'wikigdrive' });
    });*/

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    app.get('/api', (req, res) => {

    });

    app.post('/api/test', async (req, res) => {
      res.json({aaa: 1});
    });

    app.get('/file/:id', async (req, res) => {
      const fileId: string = req.params.id;

      if (isHtml(req)) {
        return res.render('file.html', { title: 'wikigdrive' });
      }

 /*     const google = this.googleFilesStorage.findFile(item => item.id === fileId);
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
      /!*
            if (!foundFile) {
              return res.status(404).send('Not found.');
            }
      *!/

      res.json({
        google, local, downloaded, api, parents, markdown, git
      });*/
    });

  /*  app.post('/file/:id/mark_dirty', async (req, res, next) => {
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
    });*/
  }

  async loadGenerated(localFile: LocalFile) {
/*
    const targetPath = path.join(this.drive_config.dest, ...localFile.localPath.substring(1).split('/'));
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    return fs.readFileSync(targetPath).toString();
*/
  }

  async run() {
    await this.startServer(3000); // TODO
  }

  getServer() {
    return this.app;
  }
}
