'use strict';

import path from 'path';
import minimist from 'minimist';
import winston from 'winston';
import {fileURLToPath} from 'url';
import {EventEmitter} from 'events';
import dotenv from 'dotenv';
import {default as envPaths, Paths} from 'env-paths';

import {addTelemetry} from '../telemetry';
import {CliParams} from '../model/CliParams';

import {createLogger} from '../utils/logger/logger';
import {ContainerEngine} from '../ContainerEngine';
import {GoogleApiContainer} from '../containers/google_api/GoogleApiContainer';
import {FileContentService} from '../utils/FileContentService';
import {AuthConfig} from '../model/AccountJson';
import {loadRunningInstance} from '../containers/server/loadRunningInstance';
import {FolderRegistryContainer} from '../containers/folder_registry/FolderRegistryContainer';
import {JobManagerContainer} from '../containers/job/JobManagerContainer';
import {WatchChangesContainer} from '../containers/changes/WatchChangesContainer';
import {ServerContainer} from '../containers/server/ServerContainer';
import {getAuthConfig} from './getAuthConfig';
import {usage} from './usage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.GIT_SHA = process.env.GIT_SHA || 'dev';

export class MainService {
  private readonly eventBus: EventEmitter;
  private readonly logger: winston.Logger;
  private containerEngine: ContainerEngine;
  private paths: Paths;
  private mainFileService: FileContentService;
  private authConfig: AuthConfig;

  constructor(private params: CliParams) {
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(0);
    if (params.debug.indexOf('main') > -1) {
      this.attachDebug();
    }

    this.paths = envPaths('wikigdrive', {suffix: null});
    this.logger = createLogger(this.params.workdir, this.eventBus);
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
    this.mainFileService = new FileContentService(this.params.workdir || process.cwd());
    await this.mainFileService.mkdir('/');

    this.authConfig = await getAuthConfig(this.params, this.mainFileService);

    if (this.params.share_email) {
      this.authConfig.share_email = this.params.share_email;
    }

    this.containerEngine = new ContainerEngine(this.logger, this.mainFileService);

    this.eventBus.on('panic:invalid_grant', () => {
      // if (configService) {
      //   await configService.saveGoogleAuth(null);
      //   await configService.flushData();
      // }
      process.exit(1);
    });
    this.eventBus.on('panic', (error) => {
      throw error;
      /*
      this.logger.error(error.stack ? error.stack : error.message);
      console.error(error.message);
      process.exit(1);
      */
    });
  }

  async cmdServer() {
    const instance = await loadRunningInstance();
    if (instance) {
      this.logger.error('WikiGDrive server already running, PID: ' + instance.pid);
      process.exit(1);
    }

    const changesContainer = new WatchChangesContainer({ name: 'watch_changes', share_email: this.params.share_email });
    await changesContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(changesContainer);
    await changesContainer.run();

    const port = parseInt(this.params.args[1]) || 3000;
    const serverContainer = new ServerContainer({ name: 'server', share_email: this.params.share_email }, port);
    await serverContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(serverContainer);
    await serverContainer.run();

    const containerEnginePromise = this.containerEngine.run();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    containerEnginePromise.then(() => {
    });

    await new Promise(resolve => {
      this.eventBus.on('end', resolve);
    });
  }

  async start() {
    const apiContainer = new GoogleApiContainer({ name: 'google_api' }, this.authConfig);
    await apiContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(apiContainer);
    await apiContainer.run();

    const folderRegistryContainer = new FolderRegistryContainer({ name: 'folder_registry' });
    await folderRegistryContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(folderRegistryContainer);
    await folderRegistryContainer.run();

    const jobManagerContainer = new JobManagerContainer({ name: 'job_manager' });
    await jobManagerContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(jobManagerContainer);
    await jobManagerContainer.run();

    await this.cmdServer();

    await this.containerEngine.flushData();
  }

}

async function main() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length < 1 || argv.h || argv.help) {
    await usage(__filename);
    process.exit(0);
  }

  // PWD is null on Windows, so we can set it here
  process.env.PWD = process.cwd();

  const params: CliParams = {
    args: argv._.slice(1),
    // drive: argv['drive'],
    workdir: argv['workdir'] || process.env.WIKIGDRIVE_WORKDIR || '/data',

    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,

    // link_mode: argv['link_mode'] || 'mdURLs',

    debug: (argv['debug'] || '').split(',').map(str => str.toLocaleString().trim()),

    service_account: argv['service_account'] || null,
    share_email: argv['share_email'] || process.env.SHARE_EMAIL || null,
    server_port: +argv['server_port']
  };

  const mainService = new MainService(params);

  try {
    await mainService.init();
  } catch (err) {
    await usage(__filename);
    console.error(err);
    process.exit(1);
  }
  return await mainService.start();
}

dotenv.config();
await addTelemetry(process.env.ZIPKIN_SERVICE || 'wikigdrive', __dirname);

try {
  await main();
  process.exit(0);
} catch (err) {
  if (err.isUsageError) {
    console.error(err.message);
    await usage(__filename);
  } else {
    console.error(err);
  }
  process.exit(1);
}
