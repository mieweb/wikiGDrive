/* eslint-disable no-async-promise-executor */
'use strict';

import EventEmitter from 'events';

import {ConfigDirPlugin} from './plugins/ConfigDirPlugin';
import {ListRootPlugin} from './plugins/ListRootPlugin';
import {WatchChangesPlugin} from './plugins/WatchChangesPlugin';
import {TransformPlugin} from './plugins/TransformPlugin';
import {GoogleApiPlugin} from './plugins/GoogleApiPlugin';
import {DownloadPlugin} from './plugins/DownloadPlugin';
import {FilesStructurePlugin} from './plugins/FilesStructurePlugin';
import {ExternalFilesPlugin} from './plugins/ExternalFilesPlugin';
import {WatchMTimePlugin} from './plugins/WatchMTimePlugin';
import {GitPlugin} from './plugins/GitPlugin';

export class MainService {

  constructor(params) {
    this.params = params;
    this.command = this.params.command;
    this.eventBus = new EventEmitter();

    if (params.debug) {
      this.attachDebug();
    }
  }

  attachDebug() {
    const eventNames = {};
    this.eventBus.on('newListener', (event) => {
      if (eventNames[event]) return;
      eventNames[event] = event;

      this.eventBus.on(event, () => {
        console.debug('OnEvent', event);
      });
    });
  }

  async init() {
    this.plugins = [];
    this.plugins.push(new ConfigDirPlugin(this.eventBus));
    this.plugins.push(new FilesStructurePlugin(this.eventBus));
    this.plugins.push(new ExternalFilesPlugin(this.eventBus));
    this.plugins.push(new GoogleApiPlugin(this.eventBus));
    this.plugins.push(new WatchMTimePlugin(this.eventBus));
    this.plugins.push(new WatchChangesPlugin(this.eventBus));
    this.plugins.push(new ListRootPlugin(this.eventBus));
    this.plugins.push(new DownloadPlugin(this.eventBus));
    this.plugins.push(new TransformPlugin(this.eventBus));
    this.plugins.push(new GitPlugin(this.eventBus));
  }

  async emitThanAwait(event, params, awaitEvents) {
    this.eventBus.emit(event, params);
    await Promise.all(awaitEvents.map(eventName => new Promise(resolve => this.eventBus.on(eventName, resolve))));
  }

  async start() {
    this.eventBus.on('panic', (error) => {
      console.error(error.message);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      setTimeout(() => {
        process.exit();
      }, 1000);
    });

    switch (this.command) {
      case 'init':
        await this.emitThanAwait('main:init', this.params, [ 'drive_config:loaded', 'files_structure:initialized' ]);
        break;

      case 'status':
        await this.emitThanAwait('main:init', this.params, [ 'drive_config:loaded', 'files_structure:initialized' ]);
        for (const plugin of this.plugins) {
          if (plugin.status) {
            await plugin.status();
          }
        }
        process.exit(0);
        break;

      case 'download':
        await this.emitThanAwait('main:init', this.params, [ 'drive_config:loaded', 'google_api:initialized', 'files_structure:initialized', 'external_files:initialized' ]);
        await this.emitThanAwait('download:process', this.params, [ 'download:clean' ]);
        break;

      case 'external':
        await this.emitThanAwait('main:init', this.params, [ 'drive_config:loaded', 'files_structure:initialized', 'external_files:initialized' ]);
        await this.emitThanAwait('external:process', this.params, [ 'external:done' ]);
        break;

      case 'transform':
        await this.emitThanAwait('main:init', this.params, [ 'drive_config:loaded', 'files_structure:initialized', 'external_files:initialized' ]);
        await this.emitThanAwait('main:transform_start', this.params, [ 'transform:clean', 'git:done' ]);
        break;

      case 'pull':
        await this.emitThanAwait('main:init', this.params, [ 'google_api:initialized', 'files_structure:initialized' ]);
        this.eventBus.on('transform:dirty', () => {
          this.eventBus.emit('download:retry');
        });
        await this.emitThanAwait('main:run_list_root', this.params, [ 'list_root:done', 'download:clean', 'transform:clean', 'git:done' ]);
        break;
      case 'watch':
        await this.emitThanAwait('main:init', this.params, [ 'google_api:initialized', 'files_structure:initialized' ]);
        await this.emitThanAwait('main:fetch_watch_token', {}, [ 'watch:token_ready' ]);

        this.eventBus.emit('main:run_list_root');

        this.eventBus.on('list_root:done', () => {
          this.eventBus.emit('main:run_watch');
        });

        await new Promise(() => {});
        break;
    }


    for (const plugin of this.plugins) {
      if (plugin.flushData) {
        await plugin.flushData();
      }
    }

    /*
    await new Promise(async (resolve, reject) => {
      setTimeout(reject, 3600 * 1000);
      await this.configService.flush();
      resolve();
    });
*/
  }

}
