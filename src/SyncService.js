/* eslint-disable no-async-promise-executor */
'use strict';

import EventEmitter from 'events';

import {ConfigDirPlugin} from './plugins/ConfigDirPlugin';
import {ListRootPlugin} from './plugins/ListRootPlugin';
import {WatchPlugin} from './plugins/WatchPlugin';
import {TransformPlugin} from './plugins/TransformPlugin';
import {GoogleApiPlugin} from './plugins/GoogleApiPlugin';
import {DownloadPlugin} from './plugins/DownloadPlugin';
import {FilesStructurePlugin} from './plugins/FilesStructurePlugin';
import {ExternalFilesPlugin} from './plugins/ExternalFilesPlugin';

export class SyncService {

  constructor(params) {
    this.params = params;
    this.eventBus = new EventEmitter();
  }

  async init() {
    this.plugins = [];
    switch (this.params.command) {
      case 'init':
        this.plugins.push(new ConfigDirPlugin(this.eventBus));
        break;
      case 'pull':
        this.plugins.push(new ConfigDirPlugin(this.eventBus));
        this.plugins.push(new FilesStructurePlugin(this.eventBus));
        this.plugins.push(new ExternalFilesPlugin(this.eventBus));
        this.plugins.push(new GoogleApiPlugin(this.eventBus));
        this.plugins.push(new WatchPlugin(this.eventBus));
        this.plugins.push(new ListRootPlugin(this.eventBus));
        this.plugins.push(new DownloadPlugin(this.eventBus));
        this.plugins.push(new TransformPlugin(this.eventBus));
        break;
      case 'watch':
        this.plugins.push(new ConfigDirPlugin(this.eventBus));
        this.plugins.push(new FilesStructurePlugin(this.eventBus));
        this.plugins.push(new ExternalFilesPlugin(this.eventBus));
        this.plugins.push(new GoogleApiPlugin(this.eventBus));
        this.plugins.push(new WatchPlugin(this.eventBus));
        this.plugins.push(new ListRootPlugin(this.eventBus));
        this.plugins.push(new DownloadPlugin(this.eventBus));
        this.plugins.push(new TransformPlugin(this.eventBus));
    }

    this.eventBus.on('panic', (error) => {
      console.error(error.message);
      process.exit(1);
    });
    this.eventBus.emit('start', this.params);

/*  MOVED TO PLUGIN
    this.configService = new ConfigService(this.params.config);

    const quotaLimiter = new QuotaLimiter(9500, 100);
    // const quotaLimiter = new QuotaLimiter(1, 5);

    this.googleAuthService = new GoogleAuthService(this.configService, quotaLimiter);
    this.googleDriveService = new GoogleDriveService(this.params['flat-folder-structure']);
    this.externalFiles = new ExternalFiles(this.configService, new HttpClient(), this.params.dest);

    this.jobsQueue = new JobsQueue();
    this.jobsPool = new JobsPool(20, this.jobsQueue);
*/
  }

  async start() {
    const promises = this.plugins.map(plugin => plugin.finished());
    await Promise.all(promises);

/*
    await new Promise(async (resolve, reject) => {
      setTimeout(reject, 3600 * 1000);
      await this.configService.flush();
      resolve();
    });
*/
  }

}
