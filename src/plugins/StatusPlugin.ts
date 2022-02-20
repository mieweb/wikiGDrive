import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import {BasePlugin} from './BasePlugin';
import {GoogleFilesStorage} from '../storage/GoogleFilesStorage';
import {DownloadFilesStorage} from '../storage/DownloadFilesStorage';

export class StatusPlugin extends BasePlugin {
  private googleFilesStorage: GoogleFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private localFilesStorage: any;
  private drive_config: any;
  private googleFileIds: string[];
  private config_dir: string;
  private dest: string;
  
  constructor(eventBus, logger) {
    super(eventBus, logger.child({filename: __filename}));

    this.googleFileIds = [];

    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });
    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });
    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('download_files:initialized', ({ downloadFilesStorage }) => {
      this.downloadFilesStorage = downloadFilesStorage;
    });
    eventBus.on('local_files:initialized', ({ localFilesStorage }) => {
      this.localFilesStorage = localFilesStorage;
    });
    eventBus.on('drive_config:loaded', async (drive_config) => {
      this.dest = drive_config.dest;
    });

    eventBus.on('status:run', async () => {
      await this.start();
    });
  }

  async start() {
    if (this.googleFileIds.length > 0) {
      console.log(chalk.blue('Files status:'));

      for (const id of this.googleFileIds) {
        const gFile = this.googleFilesStorage.findFile(item => item.id === id);
        if (gFile) {
          console.log(chalk.green('Google file:'));
          console.log(JSON.stringify(gFile, null, 2));
        }
        const dFile = this.downloadFilesStorage.findFile(item => item.id === id);
        if (dFile) {
          console.log(chalk.green('Download file:'));
          console.log(JSON.stringify(dFile, null, 2));
        }
        const lFile = this.localFilesStorage.findFile(item => item.id === id);
        if (lFile) {
          console.log(chalk.green('Local file:'));
          console.log(JSON.stringify(lFile, null, 2));
          console.log(chalk.green('Drive url:'), 'https://drive.google.com/open?id=' + id);
          if (lFile.localPath) {
            const targetPath = path.join(this.dest, lFile.localPath);
            console.log(chalk.green('Generated file:'), targetPath, fs.existsSync(targetPath) ? chalk.green('- exists') : chalk.red('- not exists'));
          }
        }
      }

    } else {
      console.log(chalk.blue('Config status:'));
      console.table(this.drive_config);

      const gFiles = this.googleFilesStorage.findFiles(item => !!item);
      const dFiles = this.downloadFilesStorage.findFiles(item => !!item);
      const lFiles = this.localFilesStorage.findFiles(item => !!item);
      console.log('Files status:');
      console.table({
        'Google files': gFiles.length,
        'Downloaded files': dFiles.length,
        'Transformed files': lFiles.length
      });
    }

    this.eventBus.emit('status:done');
  }

}
