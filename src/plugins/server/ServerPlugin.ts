'use strict';

import * as express from 'express';
import * as nunjucks from 'nunjucks';
import {Express} from 'express';
import {BasePlugin} from '../BasePlugin';
import {CliParams} from '../../MainService';
import {GoogleFilesStorage} from '../../storage/GoogleFilesStorage';
import {QueryOptions} from 'winston';

const isHtml = req => req.headers.accept.indexOf('text/html') > -1;

export class ServerPlugin extends BasePlugin {
  private app: Express;
  private googleFilesStorage: GoogleFilesStorage;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({filename: __filename}));

    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
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

  initRouter(app) {
    app.get('/', (req, res) => {
      res.render('index.html', { title: 'wikigdrive' });
    });

    app.get('/file/:id', (req, res) => {
      const fileId: string = req.params.id;

      if (isHtml(req)) {
        return res.render('file.html', { title: 'wikigdrive' });
      }

      const foundFile = this.googleFilesStorage.findFile(item => item.id === fileId);
      res.json(foundFile);
    });

    app.post('/file/:id/mark_dirty', async (req, res, next) => {
      try {
        const fileId: string = req.params.id;
        console.log('mark_dirty', fileId);
        await this.googleFilesStorage.removeFile(fileId);
        res.json({});
      } catch (err) {
        next(err);
      }
    });

    app.get('/logs', (req, res) => {
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

      // options['json'] = true;
      this.logger.query(options, (err, results) => {
        console.error(err, results);
        res.json(results);
      });
    });

/*
    for (const transport of this.logger.transports) {
      if (transport instanceof DailyRotateFile) {
      }

      console.log(transport);

    }
*/



  }
}
