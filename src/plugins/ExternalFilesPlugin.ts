'use strict';

import {BasePlugin} from './BasePlugin';
import {HttpClient} from '../utils/HttpClient';
import {ExternalFiles} from '../storage/ExternalFiles';
import {GoogleFilesStorage, MimeTypes} from '../storage/GoogleFilesStorage';
import {FileService} from '../utils/FileService';

import * as path from 'path';
import {queue} from 'async';
import {DriveConfig} from './StoragePlugin';
import {extractDocumentImages} from '../utils/extractDocumentLinks';

export class ExternalFilesPlugin extends BasePlugin {
  private externalFiles: ExternalFiles;
  private googleFilesStorage: GoogleFilesStorage;
  private config_dir: string;
  private dest: string;

  private readonly progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private handlingFiles = false;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.dest = drive_config.dest;
      await this.init();
    });
    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('external:run', async () => {
      await this.process();
    });
  }

  private async init() {
    this.externalFiles = new ExternalFiles(this.logger, this.config_dir, new HttpClient(), this.dest);
    await this.externalFiles.init();
    await this.externalFiles.cleanup();
    this.eventBus.emit('external_files:initialized', { externalFiles: this.externalFiles });
  }

  async process() {
    if (this.handlingFiles) {
      setTimeout(() => {
        this.eventBus.emit('external:run');
      }, 2000);
      return;
    }
    this.handlingFiles = true;

    await this.download();

    this.handlingFiles = false;
  }

  async download() {
    const linksToDownload = await this.externalFiles.findLinks(link => !link.md5Checksum);

    this.progress.failed = 0;
    this.progress.completed = 0;
    this.progress.total = linksToDownload.length;

    if (linksToDownload.length > 0) {
      this.logger.info('Downloading external files (' + linksToDownload.length + ')');
    } else {
      this.eventBus.emit('external:done', this.progress);
      return;
    }

    this.eventBus.emit('external:progress', this.progress);

    const CONCURRENCY = 8;

    const q = queue<any>(async (task, callback) => {
      switch (task.type) {
        case 'download':
          await this.downloadFile(task.url);
          this.progress.completed++;
          this.eventBus.emit('external:progress', this.progress);
          break;
        default:
          this.logger.error('Unknown task type: ' + task.type);
      }
      callback();
    }, CONCURRENCY);

    q.error((err, task) => {
      task.retry = (task.retry || 0) + 1;
      if (task.retry < 5) {
        this.progress.total++;
        q.push(task);
      } else {
        this.progress.failed++;
        this.eventBus.emit('external:progress', this.progress);
      }
    });

    for (const link of linksToDownload) {
      q.push({ type: 'download', url: link.url });
    }

    await q.drain();
    this.logger.info('Downloading external files finished');
    this.eventBus.emit('external:done', this.progress);
  }

  async downloadFile(url) {
    const tempPath = await this.externalFiles.downloadTemp(url, path.join(this.dest, 'external_files'));
    const fileService = new FileService();
    const md5Checksum = await fileService.md5File(tempPath);

    if (md5Checksum) {
      const localPath = path.join('external_files', md5Checksum + '.png');
      await fileService.move(tempPath, path.join(this.dest, localPath));

      await this.externalFiles.putFile({
        localPath: localPath,
        md5Checksum: md5Checksum
      });

      await this.externalFiles.addLink(url, { url, md5Checksum });
    }
  }

  async flushData() {
    return await this.externalFiles.flushData();
  }

}
