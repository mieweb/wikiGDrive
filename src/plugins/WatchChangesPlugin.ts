'use strict';

import {BasePlugin} from './BasePlugin';
import {CliParams} from "../MainService";
import {DriveConfig} from "./ConfigDirPlugin";
import {FilesStructure} from "../storage/FilesStructure";
import {GoogleDriveService, urlToFolderId} from "../google/GoogleDriveService";

export class WatchChangesPlugin extends BasePlugin {
  private command: string;
  private drive_id: string;
  private watch_mode: string;
  private debug: string[];
  private drive_config: DriveConfig;
  private filesStructure: FilesStructure;
  private auth: any;
  private googleDriveService: GoogleDriveService;
  private context: any;
  private lastMTime: string;
  private startTrackToken: string;

  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params: CliParams) => {
      this.command = params.command;
      this.watch_mode = params.watch_mode;
      this.debug = params.debug;
    });
    eventBus.on('drive_config:loaded', (drive_config: DriveConfig) => {
      this.drive_config = drive_config;
      this.drive_id = drive_config.drive_id;
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
      this.startTrackToken = await this.googleDriveService.getStartTrackToken(this.auth, this.drive_id);
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
    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    await new Promise(() => setInterval(async () => {
      try {
        const result = await this.googleDriveService.watchChanges(this.auth, this.startTrackToken, this.drive_id);

        const apiFiles = result.files.filter(file => {
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

        const changedFiles = apiFiles.map(file => {
          if (file.parentId === rootFolderId) {
            file.parentId = undefined;
          }
          return file;
        });

        if (changedFiles.length > 0) {
          console.log(changedFiles.length + ' files changed');
          await this.filesStructure.merge(changedFiles);
          this.startTrackToken = result.token; // eslint-disable-line require-atomic-updates
          console.log('Pulled latest changes');
          this.eventBus.emit('files_structure:dirty');
        } else {
          if (this.debug.indexOf('watch') > -1) {
            if (result.files.length > 0) {
              console.log('Files outside folder:', result.files);
            }
          }
          console.log('No changes detected. Sleeping for 10 seconds.');
        }

      } catch (e) {
        console.error(e);
      }
    }, 10000));
  }
}
