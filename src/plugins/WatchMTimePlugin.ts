'use strict';

import {BasePlugin} from './BasePlugin';
import {CliParams} from "../MainService";
import {DriveConfig} from "./ConfigDirPlugin";
import {FilesStructure} from "../storage/FilesStructure";
import {GoogleDriveService} from "../google/GoogleDriveService";

export class WatchMTimePlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private watch_mode: string;
  private drive_config: DriveConfig;
  private filesStructure: FilesStructure;
  private auth: any;
  private googleDriveService: GoogleDriveService;
  private context: any;
  private lastMTime: string;

  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params: CliParams) => {
      this.command = params.command;
      this.drive_id = params.drive_id;
      this.watch_mode = params.watch_mode;
    });
    eventBus.on('drive_config:loaded', (drive_config: DriveConfig) => {
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
      if (this.watch_mode !== 'mtime') {
        return;
      }
      eventBus.emit('watch:token_ready');
    });
    eventBus.on('main:run_watch', async () => {
      if (this.watch_mode !== 'mtime') {
        return;
      }
      await this.watch(this.context, this.lastMTime);
    });
  }

  async watch(context, lastMTime) {
    console.log('Watching changes with mtime');

    while (true) { // eslint-disable-line no-constant-condition
      try {
        lastMTime = this.filesStructure.getMaxModifiedTime();
        const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
        if (changedFiles.length > 0) {
          console.log(changedFiles.length + ' files modified');
          await this.filesStructure.merge(changedFiles);
          this.eventBus.emit('files_structure:dirty');
        } else {
          console.log('No files modified. Sleeping for 10 seconds.');
        }

        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      } catch (e) {
        console.error(e);
      }
    }
  }
}
