'use strict';

import {BasePlugin} from './BasePlugin';

export class ListRootPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
    });
    eventBus.on('drive_config', (drive_config) => {
      this.drive_config = drive_config;
      this.onConfigLoaded();
    });
    eventBus.on('files_initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('google_api_initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('watch_initialized', async () => {
      await this.start();
    });
  }

  async start() {
    const folderId = this.googleDriveService.urlToFolderId(this.drive_config['drive']);

    const context = { folderId: folderId };
    if (this.drive_id) {
      context.driveId = this.drive_id;
    }

    let lastMTime = this.filesStructure.getMaxModifiedTime();

    const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
    await this.filesStructure.merge(changedFiles);

    this.eventBus.emit('list_done', {
      context,
      lastMTime
    });
    this.eventBus.emit('file_structure_changed');

    switch (this.command) {
      case 'pull':
      case 'watch':
        this.resolve();
        break;
      default:
        this.reject();
    }
  }

  onConfigLoaded() {
/*
    switch (this.command) {
      case 'pull':
      case 'watch':
        break;
      default:
        this.reject();
    }
*/
  }
}
