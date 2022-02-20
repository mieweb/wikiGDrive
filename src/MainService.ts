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
import {ServiceAccountJson, UserAccountJson} from './model/AccountJson';

export class MainService {
  private readonly eventBus: EventEmitter;
  private readonly command: string;
  private readonly logger: winston.Logger;
  private readonly disable_progress: boolean;
  private containerEngine: ContainerEngine;
  private paths: Paths;
  private mainFileService: FileContentService;
  private authConfig: UserAccountJson | ServiceAccountJson;

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

    const requireAuth = ['config', 'service', 'drives', 'pull'];

    if (requireAuth.indexOf(this.command) > -1) {
      if (this.params.service_account) {
        const rootFileService = new FileContentService('/');
        this.authConfig = await rootFileService.readJson(path.resolve(this.params.service_account));
      } else
      if (this.params.client_id && this.params.client_secret) {
        this.authConfig = {
          type: 'user_account',
          client_id: this.params.client_id,
          client_secret: this.params.client_secret
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

    const transformContainer = new TransformContainer({
      name: folderId + '_transform'
    });
    await transformContainer.mount2(
      await this.mainFileService.getSubFileService(folderId, '/'),
      await this.mainFileService.getSubFileService(transformContainer.params.name, '/')
    );
    await this.containerEngine.registerContainer(transformContainer);
    await transformContainer.run();

    await this.containerEngine.unregisterContainer(transformContainer.params.name);
  }

  async cmdPull() {
    const folderId = urlToFolderId(this.params.args[0]);
    if (!folderId) {
      throw new Error('No folderId');
    }

    this.logger.info('Downloading');

    const downloadContainer = new GoogleFolderContainer({
      cmd: 'pull',
      name: folderId, //'1pfUcPgmEnzTFnlwap90XHXfRIJ1vqTgr',
      folderId: folderId,
      apiContainer: 'google_api'
    });
    await downloadContainer.mount(await this.mainFileService.getSubFileService(folderId, '/'));
    await this.containerEngine.registerContainer(downloadContainer);
    await downloadContainer.run();

    await this.cmdTransform();

    await this.containerEngine.unregisterContainer(downloadContainer.params.name);
  }

  async cmdServer() {
    const serverContainer = new ServerContainer({ name: 'server' });
    await serverContainer.mount(await this.mainFileService);
    // await serverContainer.mount(await this.rootFileService.getSubFileService(serverContainer.params.name, '/'));
    await this.containerEngine.registerContainer(serverContainer);
    await serverContainer.run();
  }

  async start() {
    if (this.authConfig) {
      const apiContainer = new GoogleApiContainer({ name: 'google_api' }, this.authConfig);
      await apiContainer.mount(await this.mainFileService);
      await this.containerEngine.registerContainer(apiContainer);
      await apiContainer.run();
    }

    switch (this.command) {
      case 'config':
        if (this.authConfig) {
          await this.mainFileService.writeJson('auth_config.json', this.authConfig);
        }
        return;
      case 'drives':
        await this.cmdDrives();
        return;
      case 'service':
        await this.cmdServer();
        return;
      case 'pull':
        await this.cmdPull();
        return;
      case 'transform':
        await this.cmdTransform();
        return;
    }

    //  const googleFileId = urlToFolderId(arg);

    const containerEnginePromise = this.containerEngine.run();

/*
    const container2 = new GoogleFolderContainer({
      name: '1pfUcPgmEnzTFnlwap90XHXfRIJ1vqTgr',
      folderId: '1pfUcPgmEnzTFnlwap90XHXfRIJ1vqTgr',
      apiContainer: 'google_api'
    });

    serverContainer.getServer().use('/' + container2.params.name, await container2.getRouter());
    await this.containerEngine.startContainer(container2);
*/

    await new Promise(resolve => {
      // setTimeout(resolve, 10000);
      this.eventBus.on('end', resolve);
    });

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
