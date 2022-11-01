'use strict';

import {EventEmitter} from 'events';
import winston from 'winston';

import {createLogger} from './utils/logger/logger';
import {ContainerEngine} from './ContainerEngine';
import {GoogleFolderContainer} from './containers/google_folder/GoogleFolderContainer';
import {GoogleApiContainer} from './containers/google_api/GoogleApiContainer';
import {FileContentService} from './utils/FileContentService';
import {default as envPaths, Paths} from 'env-paths';
import path from 'path';
import {urlToFolderId} from './utils/idParsers';
import {TransformContainer} from './containers/transform/TransformContainer';
import {CliParams} from './model/CliParams';
import {AuthConfig} from './model/AccountJson';
import {loadRunningInstance} from './containers/server/loadRunningInstance';
import {FolderRegistryContainer} from './containers/folder_registry/FolderRegistryContainer';
import {JobManagerContainer} from './containers/job/JobManagerContainer';
import fetch from 'node-fetch';
import {WatchChangesContainer} from './containers/changes/WatchChangesContainer';
import {UserConfigService} from './containers/google_folder/UserConfigService';
import {ServerContainer} from './containers/server/ServerContainer';

export class MainService {
  private readonly eventBus: EventEmitter;
  private readonly command: string;
  private readonly logger: winston.Logger;
  private containerEngine: ContainerEngine;
  private paths: Paths;
  private mainFileService: FileContentService;
  private authConfig: AuthConfig;

  constructor(private params: CliParams) {
    this.command = this.params.command;
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(0);
    if (params.debug.indexOf('main') > -1) {
      this.attachDebug();
    }

    this.paths = envPaths('wikigdrive', {suffix: null});
    this.logger = createLogger(this.eventBus, this.params.workdir);
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

    const requireAuth = ['config', 'server', 'drives', 'pull', 'register'];

    if (requireAuth.indexOf(this.command) > -1) {
      if (this.params.service_account) {
        const rootFileService = new FileContentService('/');
        this.authConfig = {
          service_account: await rootFileService.readJson(path.resolve(this.params.service_account))
        };
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

      if (this.params.share_email) {
        this.authConfig.share_email = this.params.share_email;
      }
    }

    this.containerEngine = new ContainerEngine(this.logger, this.mainFileService);

    this.eventBus.on('panic:invalid_grant', (error) => {
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
    const googleFileSystem = await this.mainFileService.getSubFileService(folderId, '/');
    await transformContainer.mount2(
      googleFileSystem,
      await this.mainFileService.getSubFileService(folderId + '_transform', '/')
    );

    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    transformContainer.setTransformSubDir(userConfigService.config.transform_subdir);

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

    const changesContainer = new WatchChangesContainer({ name: 'watch_changes' });
    await changesContainer.mount(await this.mainFileService);
    await this.containerEngine.registerContainer(changesContainer);
    await changesContainer.run();

    const port = parseInt(this.params.args[0]) || 3000;
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

  async cmdInspect() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    const instance = await loadRunningInstance();
    if (!instance) {
      this.logger.error('WikiGDrive server is not running');
      process.exit(1);
    }

    const response = await fetch(`http://localhost:${instance.port}/api/drive/${folderId}/inspect`);
    const json = await response.json();

    console.log(json);
  }

  async cmdPs() {
    const instance = await loadRunningInstance();
    if (!instance) {
      this.logger.error('WikiGDrive server is not running');
      process.exit(1);
    }

    const response = await fetch(`http://localhost:${instance.port}/api/ps`);
    const json = await response.json();

    console.table(json);
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
      case 'ps':
        await this.cmdPs();
        break;
      case 'inspect':
        await this.cmdInspect();
        break;
    }

    await this.containerEngine.flushData();
  }

}
