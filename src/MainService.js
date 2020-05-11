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

export class MainService {

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
        break;
    }
  }

  async start() {
    this.eventBus.on('panic', (error) => {
      console.error(error.message);
      process.exit(1);
    });
    this.eventBus.emit('main:init', this.params);

    this.eventBus.emit('main:pre_list_root');
    this.eventBus.emit('main:run_list_root');

    const promises = [];

    switch (this.params.command) {
      case 'pull':
        promises.push(new Promise(resolve => {
          this.eventBus.on('list_root:done', resolve);
        }));
        promises.push(new Promise(resolve => {
          this.eventBus.on('download:clean', resolve); // TODO: emit
        }));
        promises.push(new Promise(resolve => {
          this.eventBus.on('transform:clean', resolve); // TODO: emit
        }));
        break;
      case 'watch':
        promises.push(new Promise());
        this.eventBus.emit('main:run_watch');
        break;
    }

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
