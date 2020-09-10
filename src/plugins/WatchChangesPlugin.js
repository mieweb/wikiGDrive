'use strict';

import {BasePlugin} from './BasePlugin';

export class WatchChangesPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
      this.watch_mode = params.watch_mode;
    });
    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('google_api:initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('list_root:done', ({ context, lastMTime }) => {
      this.context = context;
      this.lastMTime = lastMTime;
    });
    eventBus.on('main:fetch_watch_token', async () => {
      if (this.watch_mode !== 'changes') {
        return;
      }
      this.startTrackToken = await this.googleDriveService.getStartTrackToken(this.auth);
      eventBus.emit('watch:token_ready');
    });
    eventBus.on('main:run_watch', async () => {
      if (this.watch_mode !== 'changes') {
        return;
      }
      await this.watch();
    });
  }

  async watch() {
    console.log('Watching changes');
    const rootFolderId = this.googleDriveService.urlToFolderId(this.drive_config['drive']);

    await new Promise(() => setInterval(async () => {
      try {
        const result = await this.googleDriveService.watchChanges(this.auth, this.startTrackToken, this.drive_id);

        const changedFiles = result.files.filter(file => {
          let retVal = false;
          file.parents.forEach((parentId) => {
            if (parentId === rootFolderId) {
              retVal = true;
            }
            if (this.filesStructure.containsFile(parentId)) {
              retVal = true;
            }
          });
          return retVal;
        });

        if (changedFiles.length > 0) {
          console.log(changedFiles.length + ' files modified');
          await this.filesStructure.merge(changedFiles);
          this.startTrackToken = result.token; // eslint-disable-line require-atomic-updates
          console.log('Pulled latest changes');
        } else {
          console.log('No changes detected. Sleeping for 10 seconds.');
        }

      } catch (e) {
        console.error(e);
      }
    }, 10000));
  }
}
