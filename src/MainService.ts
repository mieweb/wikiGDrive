'use strict';

import {EventEmitter} from 'events';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

import {StoragePlugin} from './plugins/StoragePlugin';
import {SyncPlugin} from './plugins/SyncPlugin';
import {WatchChangesPlugin} from './plugins/WatchChangesPlugin';
import {GoogleApiPlugin} from './plugins/GoogleApiPlugin';
import {DownloadPlugin} from './plugins/DownloadPlugin';
import {ExternalFilesPlugin} from './plugins/ExternalFilesPlugin';
import {WatchMTimePlugin} from './plugins/WatchMTimePlugin';
import {GitPlugin} from './plugins/GitPlugin';
import {ListDrivesPlugin} from './plugins/ListDrivesPlugin';
import {BasePlugin} from './plugins/BasePlugin';
import {ProgressPlugin} from './progress/ProgressPlugin';
import {GoogleFilesStorage} from './storage/GoogleFilesStorage';
import {argsToGoogleFileIds} from './utils/idParsers';
import {createLogger} from './utils/logger';
import {TransformPlugin} from './plugins/TransformPlugin';

export enum LinkMode {
  dirURLs = 'dirURLs',
  mdURLs = 'mdURLs',
  uglyURLs = 'uglyURLs'
}

export interface CliParams {
  config_dir: string;
  link_mode: LinkMode;
  dest: string;
  flat_folder_structure: boolean;
  drive_id: string;
  drive: string;
  command: string;
  args: string[];
  watch_mode: string;
  debug: string[];
  force: boolean;

  disable_progress: Boolean;

  client_id?: string;
  client_secret?: string;
  service_account?: string;
  git_update_delay: number;
}


export class MainService {
  private readonly eventBus: EventEmitter;
  private readonly command: string;
  private plugins: BasePlugin[];
  private readonly logger: winston.Logger;
  private readonly disable_progress: Boolean;

  constructor(private params: CliParams) {
    this.command = this.params.command;
    this.disable_progress = params.disable_progress;
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(0);
    if (params.debug.indexOf('main') > -1) {
      this.attachDebug();
    }

    this.logger = createLogger(this.eventBus);
  }

  attachDebug() {
    const eventNames = {};
    this.eventBus.on('newListener', (event) => {
      if (eventNames[event]) return;
      eventNames[event] = event;

      this.eventBus.on(event, () => {
        this.logger.debug('OnEvent', event);
      });
    });
  }

  async init() {
    this.plugins = [];
    if (!this.disable_progress) {
      this.plugins.push(new ProgressPlugin(this.eventBus, this.logger));
    }
    this.plugins.push(new StoragePlugin(this.eventBus, this.logger));
    this.plugins.push(new ExternalFilesPlugin(this.eventBus, this.logger));
    this.plugins.push(new GoogleApiPlugin(this.eventBus, this.logger));
    this.plugins.push(new WatchMTimePlugin(this.eventBus, this.logger));
    this.plugins.push(new WatchChangesPlugin(this.eventBus, this.logger));
    this.plugins.push(new SyncPlugin(this.eventBus, this.logger));
    this.plugins.push(new DownloadPlugin(this.eventBus, this.logger));
    this.plugins.push(new TransformPlugin(this.eventBus, this.logger));
    this.plugins.push(new GitPlugin(this.eventBus, this.logger));
    this.plugins.push(new ListDrivesPlugin(this.eventBus, this.logger));
  }

  async emitThanAwait(event, params, awaitEvents) {
    const promises = awaitEvents.map(eventName => new Promise(resolve => this.eventBus.on(eventName, resolve)));
    this.eventBus.emit(event, params);
    await Promise.all(promises);
  }

  async start() {
    this.eventBus.on('drive_config:loaded', async (drive_config) => {
      const logsDir = path.join(this.params.config_dir, 'logs');

      this.logger.add(new winston.transports.DailyRotateFile({
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        dirname: logsDir,
        filename: '%DATE%-error.log',
        level: 'error'
      }));
      this.logger.add(new winston.transports.DailyRotateFile({
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        dirname: logsDir,
        filename: '%DATE%-combined.log'
      }));

      if (!this.disable_progress) {
        for (const transport of this.logger.transports) {
          if (transport instanceof winston.transports.Console) {
            this.logger.remove(transport);
          }
        }
      }
    });

    this.eventBus.on('panic', (error) => {
      throw error;
/*
      if (error.stack) {
        this.logger.error(error.stack);
      } else {
        this.logger.error(error.message);
      }
      if (error.origError) {
        this.logger.error(error.origError);
      }

      console.error(error.message);
      process.exit(1);
*/
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT');
      for (const plugin of this.plugins) {
        if (plugin.flushData) {
          await plugin.flushData();
        }
      }
      process.exit();
    });

    let googleFilesStorage: GoogleFilesStorage;
    this.eventBus.on('google_files:initialized', ({ googleFilesStorage: param }) => {
      googleFilesStorage = param;
    });

    switch (this.command) {
      case 'init':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded' ]);
        break;

      case 'status':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded' ]);
        for (const plugin of this.plugins) {
          if (plugin.status) {
            await plugin.status();
          }
        }
        process.exit(0);
        break;

      case 'sync':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded', 'google_api:done' ]);
        this.eventBus.emit('main:set_google_file_ids_filter', argsToGoogleFileIds(this.params.args, googleFilesStorage));

        await this.emitThanAwait('sync:run', {}, [ 'sync:done' ]);
        break;

      case 'download':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded', 'google_api:done' ]);
        this.eventBus.emit('main:set_google_file_ids_filter', argsToGoogleFileIds(this.params.args, googleFilesStorage));

        await this.emitThanAwait('download:run', {}, [ 'download:done' ]);
        break;

      case 'external':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded', 'google_api:done' ]);
        this.eventBus.emit('main:set_google_file_ids_filter', argsToGoogleFileIds(this.params.args, googleFilesStorage));

        await this.emitThanAwait('external:run', {}, [ 'external:done' ]);
        break;

      case 'transform':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded' ]);
        this.eventBus.emit('main:set_google_file_ids_filter', argsToGoogleFileIds(this.params.args, googleFilesStorage));

        await this.emitThanAwait('transform:run', {}, [ 'transform:done', 'git:done' ]);
        break;

      case 'clear:transform':
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded' ]);
        await this.emitThanAwait('transform:clear', {}, [ 'transform:cleared' ]);
        break;

      case 'pull':
        this.eventBus.on('transform:dirty', () => {
          this.eventBus.emit('download:retry');
        });

        await this.emitThanAwait('main:run', this.params, [ 'google_api:done' ]);
        this.eventBus.emit('main:set_google_file_ids_filter', argsToGoogleFileIds(this.params.args, googleFilesStorage));

        await this.emitThanAwait('sync:run', {}, [ 'sync:done' ]);
        await this.emitThanAwait('download:run', {}, [ 'download:done' ]);
        // await this.emitThanAwait('external:run', {}, [ 'external:done' ]);
        await this.emitThanAwait('transform:run', {}, [ 'git:done' ]);

        break;

      case 'watch':
        this.eventBus.on('transform:dirty', () => {
          this.eventBus.emit('download:retry');
        });

        await this.emitThanAwait('main:run', this.params, [ 'google_api:done' ]);

        if (this.params.watch_mode === 'changes') {
          await this.emitThanAwait('watch_changes:fetch_token', {}, [ 'watch_changes:token_ready' ]);
        }

        await this.emitThanAwait('sync:run', {}, ['sync:done']);
        await this.emitThanAwait('download:run', {}, [ 'download:done' ]);
        // await this.emitThanAwait('external:run', {}, [ 'external:done' ]);
        await this.emitThanAwait('transform:run', {}, [ 'git:done' ]);

        this.eventBus.on('google_files:dirty', async () => {
          this.eventBus.emit('download:run');
        });
        this.eventBus.on('download:complete', async () => {
          this.eventBus.emit('transform:run');
        });

        await this.emitThanAwait('watch:run', {}, ['watch:done']);

        break;

      case 'drives':
        await this.emitThanAwait('main:run', this.params, [ 'google_api:done' ]);

        this.eventBus.on('list_drives:done', (drives) => {
          console.log('Available drives:');
          console.table(drives);
        });

        await this.emitThanAwait('list_drives:run', {}, [ 'list_drives:done' ]);
        break;

      default:
        await this.emitThanAwait('main:run', this.params, [ 'drive_config:loaded' ]);
        this.logger.error('Unknown command: ' + this.command);
        break;
    }

    for (const plugin of this.plugins) {
      if (plugin.flushData) {
        await plugin.flushData();
      }
    }

    this.eventBus.emit('main:done');
  }

}
