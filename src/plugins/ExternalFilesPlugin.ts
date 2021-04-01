'use strict';

import {BasePlugin} from './BasePlugin';
import {ExternalFilesStorage} from '../storage/ExternalFilesStorage';
import {DownloadFilesStorage} from '../storage/DownloadFilesStorage';
import {FileService} from '../utils/FileService';

import * as path from 'path';
import * as fs from 'fs';
import {queue} from 'async';

export class ExternalFilesPlugin extends BasePlugin {
  private externalFilesStorage: ExternalFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private config_dir: string;
  private googleFileIds: string[];

  private readonly progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private handlingFiles = false;
  private auth: any;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    this.googleFileIds = [];
    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });
    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('download_files:initialized', ({ downloadFilesStorage }) => {
      this.downloadFilesStorage = downloadFilesStorage;
    });
    eventBus.on('external_files:initialized', ({ externalFilesStorage }) => {
      this.externalFilesStorage = externalFilesStorage;
    });
    eventBus.on('google_api:done', ({ auth }) => {
      this.auth = auth;
    });
    eventBus.on('external:run', async () => {
      await this.process();
    });
  }

  async process() {
    if (this.handlingFiles) {
      setTimeout(() => {
        this.eventBus.emit('external:run');
      }, 2000);
      return;
    }

    await this.start();
  }

  async start() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    if (!fs.existsSync(path.join(this.config_dir, 'external_files'))) {
      fs.mkdirSync(path.join(this.config_dir, 'external_files'), { recursive: true });
    }
    await this.cleanup();

    const downloadFiles = this.downloadFilesStorage.findFiles((file) => {
      if (!this.googleFileIds || this.googleFileIds.length === 0) {
        return true;
      }
      return this.googleFileIds.indexOf(file.id) > -1;
    });


    const urlsToDownload = [];
    for (const downloadFile of downloadFiles) {
      if (downloadFile.images) {
        for (const k in downloadFile.images) {
          const url = downloadFile.images[k];
          const found = this.externalFilesStorage.findFile(file => file.urls.indexOf(url) > -1);
          if (!found) {
            urlsToDownload.push(url);
          }
        }
      }
    }

    if (urlsToDownload.length === 0) {
      this.eventBus.emit('external:done', this.progress);
      return;
    }

    this.logger.info('Downloading external files (' + urlsToDownload.length + ')');

    this.progress.failed = 0;
    this.progress.completed = 0;
    this.progress.total = urlsToDownload.length;
    this.eventBus.emit('external:progress', this.progress);

    const CONCURRENCY = 8;

    const q = queue<any>(async (task, callback) => {
      switch (task.type) {
        case 'download':
          try {
            await this.downloadFile(task.url, this.auth);
            this.progress.completed++;
            this.eventBus.emit('external:progress', this.progress);
          } catch (err) {
            callback(err);
            return;
          }
          break;
        default:
          this.logger.error('Unknown task type: ' + task.type);
      }
      callback();
    }, CONCURRENCY);

    q.error((err, task) => {
      this.logger.error(err);
      if (task.retry > 0) {
        task.retry--;
        q.push(task);
      } else {
        this.logger.error(err);
        this.progress.failed++;
      }
      this.eventBus.emit('external:progress', this.progress);
    });

    console.log('urlsToDownload', urlsToDownload);
    for (const url of urlsToDownload) {
      q.push({ type: 'download', url, retry: 0 });
    }

    await q.drain();
    process.exit(1);

    this.logger.info('Downloading external files finished');
    this.eventBus.emit('external:done', this.progress);
    this.handlingFiles = false;
  }

  async downloadFile(url, auth) {
    const tempPath = await this.externalFilesStorage.downloadTemp(url, path.join(this.config_dir, 'external_files'), auth);
    const fileService = new FileService();
    const ext = await fileService.guessExtension(tempPath);
    const md5Checksum = await fileService.md5File(tempPath);

    if (md5Checksum) {
      const localPath = path.join('external_files', md5Checksum + '.' + ext);
      await fileService.move(tempPath, path.join(this.config_dir, localPath));
      await this.externalFilesStorage.addUrl(url, md5Checksum, ext);
    }
  }

  async cleanup() {
    const tempPath = path.join(this.config_dir, 'external_files');

    if (!fs.existsSync(tempPath)) {
      return;
    }

    const files = fs.readdirSync(tempPath);
    for (const file of files) {
      if (file.startsWith('temp_') && file.endsWith('_ext')) {
        fs.unlinkSync(path.join(tempPath, file));
      }
    }
  }

}
