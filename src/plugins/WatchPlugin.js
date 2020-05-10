'use strict';

import {BasePlugin} from './BasePlugin';

export class WatchPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
    });
    eventBus.on('drive_config', (drive_config) => {
      this.drive_config = drive_config;
      this.watch_mode = drive_config.watch_mode;
    });
    eventBus.on('files_initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('google_api_initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;

      setTimeout(async () => {
        await this.startWatch();
      }, 100);
    });
    eventBus.on('list_done', ({ context, lastMTime }) => {
      setTimeout(async () => {
        await this.start(context, lastMTime);
      }, 100);
    });
  }

  async startWatch() {
    switch (this.command) {
      case 'pull':
        this.eventBus.emit('watch_initialized');
        this.resolve();
        return;
      case 'watch':
        await this.watch(this.watch_mode);
        this.eventBus.emit('watch_initialized');
        this.resolve();
        break;
      default:
        this.reject();
    }
  }

  async watch(watch_mode) {
    switch (watch_mode) {
      case 'mtime':
        break;
      default:
        this.startTrackToken = await this.googleDriveService.getStartTrackToken(this.auth);
        break;
    }
  }

  async start(context, lastMTime) {
    switch (this.watch_mode) {
      case 'mtime':
        console.log('Watching changes with mtime');

        while (true) { // eslint-disable-line no-constant-condition
          try {
            lastMTime = this.filesStructure.getMaxModifiedTime();
            const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
            await this.filesStructure.merge(changedFiles);
            await this.handleChangedFiles();

            console.log('Sleeping for 10 seconds.');

            await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
          } catch (e) {
            console.error(e);
          }
        }

      default:
        console.log('Watching changes');

        await new Promise(() => setInterval(async () => {
          try {
            const result = await this.googleDriveService.watchChanges(this.auth, this.startTrackToken, this.drive_id);

            const changedFiles = result.files.filter(file => {
              let retVal = false;
              file.parents.forEach((parentId) => {
                if (this.filesStructure.containsFile(parentId)) {
                  retVal = true;
                }
              });
              return retVal;
            });

            if (changedFiles.length > 0) {
              console.log(changedFiles.length + ' files modified');
              await this.filesStructure.merge(changedFiles);
              console.log('Pulled latest changes');
            } else {
              console.log('No changes detected. Sleeping for 10 seconds.');
            }

            await this.handleChangedFiles();

            this.startTrackToken = result.token; // eslint-disable-line require-atomic-updates
          } catch (e) {
            console.error(e);
          }
        }, 10000));
        break;
    }
  }
}
