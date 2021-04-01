'use strict';

import * as fs from 'fs';
import * as path from 'path';

import {BasePlugin} from './BasePlugin';
import {FileService} from '../utils/FileService';
import {CliParams, LinkMode} from '../MainService';
import {GoogleFilesStorage} from '../storage/GoogleFilesStorage';
import {DownloadFilesStorage} from '../storage/DownloadFilesStorage';
import {ExternalFilesStorage} from '../storage/ExternalFilesStorage';
import {HttpClient} from '../utils/HttpClient';

export interface DriveConfig {
  drive: string;
  drive_id: string;
  dest: string;
  flat_folder_structure: boolean;

  link_mode: LinkMode;

  client_id?: string;
  client_secret?: string;
  service_account?: string;
}

export class StoragePlugin extends BasePlugin {
  private fileService: FileService;
  private command: string;
  private driveConfig: DriveConfig;
  private config_dir: string;
  private params: CliParams;
  private googleFilesStorage: GoogleFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private externalFilesStorage: ExternalFilesStorage;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.fileService = new FileService();
    // this.filePath = filePath;

    eventBus.on('main:run', async (params) => {
      this.command = params.command;
      this.config_dir = params.config_dir;
      this.params = params;
      await this.init(params);
    });
    eventBus.on('quota_jobs:save', async (jobs) => {
      await this._saveConfig(path.join(this.config_dir, 'quota.json'), {
        jobs
      });
    });
  }

  async initConfigDir(params: CliParams) {
    if (fs.existsSync(this.config_dir)) {
      if (fs.lstatSync(this.config_dir).isDirectory()) {
        throw '.wgd already exists - WikiGDrive already initialized.';
      } else {
        throw '.wgd is not a directory';
      }
    }

    if (!params['drive']) {
      throw '--drive not specified';
    }

    if (!params['service_account'] && !params['client_id']) {
      throw 'service_account or client_id / client_id not specified';
    }

    const driveConfig: DriveConfig = {
      drive: params.drive,
      drive_id: params.drive_id,
      dest: params.dest,
      flat_folder_structure: !!params.flat_folder_structure,
      link_mode: params.link_mode
    };

    if (params['service_account']) {
      driveConfig.service_account = params['service_account'];
    } else {
      driveConfig.client_id = params['client_id'];
      driveConfig.client_secret = params['client_secret'];
    }

    fs.mkdirSync(params.config_dir, { recursive: true });
    fs.mkdirSync(path.join(params.config_dir, 'hooks'), { recursive: true });

    await this._saveConfig(path.join(params.config_dir, 'drive.json'), driveConfig);
  }

  async loadDriveConfig() {
    if (!fs.existsSync(this.config_dir)) {
      this.eventBus.emit('panic', {
        message: 'WikiGDrive not initialized. Run: wikigdrive init'
      });
    }
    if (!fs.lstatSync(this.config_dir).isDirectory()) {
      this.eventBus.emit('panic', {
        message: 'File .wgd is not a directory.'
      });
    }
    if (!fs.existsSync(path.join(this.config_dir, 'temp'))) {
      fs.mkdirSync(path.join(this.config_dir, 'temp'), { recursive: true });
    }

    this.driveConfig = await this._loadConfig(path.join(this.config_dir, 'drive.json'));
    const quotaConfig = await this._loadConfig(path.join(this.config_dir, 'quota.json'));
    this.eventBus.emit('quota_jobs:loaded', quotaConfig.jobs || []);
    await this.initStorages();
    this.eventBus.emit('drive_config:loaded', this.driveConfig);
  }

  async initStorages() {
    this.googleFilesStorage = new GoogleFilesStorage(this.config_dir);
    await this.googleFilesStorage.init();
    this.eventBus.emit('google_files:initialized', { googleFilesStorage: this.googleFilesStorage });

    this.downloadFilesStorage = new DownloadFilesStorage(this.config_dir);
    await this.downloadFilesStorage.init();
    this.eventBus.emit('download_files:initialized', { downloadFilesStorage: this.downloadFilesStorage });

    this.externalFilesStorage = new ExternalFilesStorage(this.logger, this.config_dir, new HttpClient());
    await this.externalFilesStorage.init();
    this.eventBus.emit('external_files:initialized', { externalFilesStorage: this.externalFilesStorage });
  }

  async _loadConfig(filePath) {
    try {
      const content = await this.fileService.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  async _saveConfig(filePath, config) {
    const content = JSON.stringify(config, null, 2);
    return this.fileService.writeFile(filePath, content);
  }

  async status() {
    await this.loadDriveConfig();
    console.log('Config status:');
    console.table(this.driveConfig);
  }

  private async init(params) {
    switch (this.command) {
      case 'init':
        await this.initConfigDir(params);
        process.exit(0);
        return;
      default:
        await this.loadDriveConfig();
        break;
    }
  }

  async flushData() {
    if (this.googleFilesStorage) {
      await this.googleFilesStorage.flushData();
    }
    if (this.downloadFilesStorage) {
      await this.downloadFilesStorage.flushData();
    }
  }

}
