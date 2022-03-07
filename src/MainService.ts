'use strict';

import {EventEmitter} from 'events';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

import {createLogger} from './utils/logger';
import {ContainerEngine} from './ContainerEngine';
import {ServerContainer} from './containers/server/ServerContainer';
import {GoogleFolderContainer} from './containers/google_folder/GoogleFolderContainer';
import {GoogleApiContainer} from './containers/google_api/GoogleApiContainer';
import {FileContentService} from './utils/FileContentService';
import {default as envPaths, Paths} from 'env-paths';
import * as path from 'path';
import {urlToFolderId} from './utils/idParsers';
import {TransformContainer} from './containers/transform/TransformContainer';
import {CliParams} from './model/CliParams';
import {AuthConfig} from './model/AccountJson';
import {loadRunningInstance} from './containers/server/loadRunningInstance';
import {FolderRegistryContainer} from './containers/folder_registry/FolderRegistryContainer';
import {JobManagerContainer} from './containers/job/JobManagerContainer';

export class MainService {
  private readonly eventBus: EventEmitter;
  private readonly command: string;
  private readonly logger: winston.Logger;
  private readonly disable_progress: boolean;
  private containerEngine: ContainerEngine;
  private paths: Paths;
  private mainFileService: FileContentService;
  private authConfig: AuthConfig;

  constructor(private params: CliParams) {
    this.command = this.params.command;
    this.disable_progress = !!params.disable_progress || this.command === 'drives' || this.command === 'status';
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(0);
    if (params.debug.indexOf('main') > -1) {
      this.attachDebug();
    }

    this.paths = envPaths('wikigdrive', {suffix: null});
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
    this.mainFileService = new FileContentService(this.params.dest || process.cwd());
    await this.mainFileService.mkdir('/');

    const requireAuth = ['config', 'server', 'drives', 'pull', 'register'];

    if (requireAuth.indexOf(this.command) > -1) {
      if (this.params.service_account) {
        const rootFileService = new FileContentService('/');
        this.authConfig = await rootFileService.readJson(path.resolve(this.params.service_account));
      } else
      if (this.params.client_id && this.params.client_secret) {
        this.authConfig = {
          user_account: {
            type: 'user_account',
            client_id: this.params.client_id,
            client_secret: this.params.client_secret
          }
        };
      } else {
        this.authConfig = await this.mainFileService.readJson('auth_config.json');
      }

      if (!this.authConfig) {
        throw new Error('No authentication credentials provided');
      }
    }

    this.containerEngine = new ContainerEngine(this.logger, this.mainFileService);

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
  }

  async cmdDrives() {
    const apiContainer: GoogleApiContainer = <GoogleApiContainer>this.containerEngine.getContainer('google_api');
    const drives = await apiContainer.listDrives();
    console.log('Available drives:');
    console.table(drives);
  }

  async cmdTransform() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    this.logger.info('Transforming');

    const filesIds = this.params.args.slice(1);
    const transformContainer = new TransformContainer({
      name: folderId
    }, { filesIds });
    await transformContainer.mount2(
      await this.mainFileService.getSubFileService(folderId, '/'),
      await this.mainFileService.getSubFileService(folderId + '_transform', '/')
    );
    await this.containerEngine.registerContainer(transformContainer);

    await transformContainer.run(folderId);

    await this.containerEngine.unregisterContainer(transformContainer.params.name);
  }

  async cmdPull() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    this.logger.info('Downloading');

    const filesIds = this.params.args.slice(1);
    const downloadContainer = new GoogleFolderContainer({
      cmd: 'pull',
      name: folderId,
      folderId: folderId,
      apiContainer: 'google_api'
    }, { filesIds });
    await downloadContainer.mount(await this.mainFileService.getSubFileService(folderId, '/'));
    await this.containerEngine.registerContainer(downloadContainer);
    await downloadContainer.run();
    await this.containerEngine.unregisterContainer(downloadContainer.params.name);

    await this.cmdTransform();
  }

  async cmdPrune() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    const folderRegistryContainer = <FolderRegistryContainer>this.containerEngine.getContainer('folder_registry');
    await folderRegistryContainer.pruneFolder(folderId);
  }

  async cmdRegister() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    const folderRegistryContainer = <FolderRegistryContainer>this.containerEngine.getContainer('folder_registry');
    const folder = await folderRegistryContainer.registerFolder(folderId);
    if (folder.new) {
      await this.cmdPull();
    }
  }

  async cmdUnregister() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    const folderRegistryContainer = <FolderRegistryContainer>this.containerEngine.getContainer('folder_registry');
    await folderRegistryContainer.unregisterFolder(folderId);
  }

  async cmdServer() {
    const instance = await loadRunningInstance();
    if (instance) {
      this.logger.error('WikiGDrive server already running, PID: ' + instance.pid);
      process.exit(1);
    }

    const port = parseInt(this.params.args[0]) || 3000;
    const serverContainer = new ServerContainer({ name: 'server' }, port);
    await serverContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(serverContainer);
    await serverContainer.run();

    const containerEnginePromise = this.containerEngine.run();

    await new Promise(resolve => {
      this.eventBus.on('end', resolve);
    });
  }

  async start() {
    if (this.authConfig) {
      const apiContainer = new GoogleApiContainer({ name: 'google_api' }, this.authConfig);
      await apiContainer.mount(await this.mainFileService);
      await this.containerEngine.registerContainer(apiContainer);
      await apiContainer.run();
    }

    const folderRegistryContainer = new FolderRegistryContainer({ name: 'folder_registry' });
    await folderRegistryContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(folderRegistryContainer);
    await folderRegistryContainer.run();


    const jobManagerContainer = new JobManagerContainer({ name: 'job_manager' });
    await jobManagerContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(jobManagerContainer);
    await jobManagerContainer.run();

    switch (this.command) {
      case 'config':
        if (this.authConfig) {
          await this.mainFileService.writeJson('auth_config.json', this.authConfig);
        }
        break;
      case 'drives':
        await this.cmdDrives();
        break;
      case 'server':
        await this.cmdServer();
        break;
      case 'pull':
        await this.cmdPull();
        break;
      case 'transform':
        await this.cmdTransform();
        break;
      case 'prune':
        await this.cmdPrune();
        break;
      case 'register':
        await this.cmdRegister();
        break;
      case 'unregister':
        await this.cmdUnregister();
        break;
    }

    await this.containerEngine.flushData();
/*
    this.eventBus.on('drive_config:loaded', async (drive_config) => {
      const logsDir = path.join(this.params.config_dir, 'logs');

      this.logger.add(new winston.transports.DailyRotateFile({
        format: winston.format.json(),
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        dirname: logsDir,
        createSymlink: true,
        symlinkName: 'error.log',
        filename: '%DATE%-error.log',
        level: 'error',
        json: true
      }));
      this.logger.add(new winston.transports.DailyRotateFile({
        format: winston.format.json(),
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        dirname: logsDir,
        createSymlink: true,
        symlinkName: 'combined.log',
        filename: '%DATE%-combined.log',
        json: true
      }));
    });
*/
  }

}
