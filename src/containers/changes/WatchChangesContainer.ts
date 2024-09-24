import winston from 'winston';
import {fileURLToPath} from 'url';

import {Container, ContainerEngine} from '../../ContainerEngine.ts';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {GoogleTreeProcessor} from '../google_folder/GoogleTreeProcessor.ts';
import {initJob, JobManagerContainer} from '../job/JobManagerContainer.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {type FileId} from '../../model/model.ts';
import {TelemetryClass, TelemetryMethod, TelemetryMethodDisable} from '../../telemetry.ts';
import {HasAccessToken} from '../../google/AuthClient.ts';

const __filename = fileURLToPath(import.meta.url);

@TelemetryClass()
export class WatchChangesContainer extends Container {
  private logger: winston.Logger;
  private auth: HasAccessToken;
  private googleDriveService: GoogleDriveService;
  private lastToken: { [driveId: string]: string } = {};
  private intervals: { [driveId: string]: NodeJS.Timeout } = {};
  private working: { [driveId: string]: boolean } = {};

  @TelemetryMethodDisable()
  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    const googleApiContainer = <GoogleApiContainer>engine.getContainer('google_api');
    this.auth = googleApiContainer.getAuth();
    this.googleDriveService = new GoogleDriveService(this.logger, googleApiContainer.getQuotaLimiter());

    this.engine.subscribe('gdrive:changed', async (driveId) => {
      const folderFilesService = await this.filesService.getSubFileService(driveId, '/');
      const treeProcessor = new GoogleTreeProcessor(folderFilesService);
      await treeProcessor.load();

      const changes = await this.getChanges(driveId);
      const filteredChanges = [];
      for (const change of changes) {
        const [leaf] = await treeProcessor.findById(change.id);

        if (!leaf) {
          if (!change.trashed) {
            filteredChanges.push(change);
          }
          continue;
        }

        if (leaf.modifiedTime < change.modifiedTime) {
          filteredChanges.push(change);
        }
      }
      await this.setChanges(driveId, filteredChanges);
    });

    this.engine.subscribe('drive:register', (driveId, drive) => {
      if (drive.driveId) {
        this.startWatching(drive.driveId);
      }
    });
    this.engine.subscribe('drive:unregister', (driveId) => {
      this.stopWatching(driveId);
      this.engine.emit(driveId, 'toasts:added', {
        type: 'drive:unregister',
        links: {},
        title: 'WikiGDrive access to Google Drive removed',
        description: `Access for ${this.params.share_email} has been removed`
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async getChanges(driveId: string): Promise<GoogleFile[]> {
    const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
    return await driveFileSystem.readJson('.changes.json') || [];
  }

  async setChanges(driveId, changes: GoogleFile[]) {
    const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
    await driveFileSystem.writeJson('.changes.json', changes);
    this.engine.emit(driveId, 'changes:changed', changes);

    const userConfigService = new UserConfigService(driveFileSystem);
    await userConfigService.load();

    if (changes.length > 0 && userConfigService.config.auto_sync) {
      const fileIdsString = changes.map(change => change.id).join(',');

      const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
      await jobManagerContainer.schedule(driveId, {
        ...initJob(),
        type: 'sync',
        payload: fileIdsString,
        title: 'Syncing file: ' + fileIdsString
      });
      await jobManagerContainer.schedule(driveId, {
        ...initJob(),
        type: 'transform',
        title: 'Transform markdown'
      });
    }
  }

  @TelemetryMethodDisable()
  async startWatching(driveId: string) {
    if (this.intervals[driveId]) {
      return;
    }

    this.logger.info('Starting watching: ' + driveId);

    this.intervals[driveId] = setInterval(async () => {
      if (!this.auth) {
        return;
      }
      if (this.working[driveId]) {
        return;
      }
      this.working[driveId] = true;
      try {
        if (!this.lastToken[driveId]) {
          this.lastToken[driveId] = await this.googleDriveService.getStartTrackToken(this.auth, driveId);
          // await this.googleDriveService.setupWatchChannel(this.auth, this.lastToken[driveId], driveId);
          return;
        }

        await this.watchDriveChanges(driveId);
      } catch (err) {
        this.logger.warn(err.message);
        if (err.status === 403 && err.message.indexOf('The attempted action requires shared drive membership') > -1) {
          const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
          await folderRegistryContainer.refreshDrives();
        }
      } finally {
        delete this.working[driveId];
      }
    }, 3000);
  }

  @TelemetryMethod({ paramsCount: 1 })
  async watchDriveChanges(driveId: FileId) {
    const changes = await this.googleDriveService.watchChanges(this.auth, this.lastToken[driveId], driveId);
    if (changes.files.length > 0) {
      let dbChanges = await this.getChanges(driveId);
      for (const file of changes.files) {
        dbChanges = dbChanges.filter(f => f.id !== file.id);
        dbChanges.push(file);
      }
      await this.setChanges(driveId, dbChanges);
    }
    this.lastToken[driveId] = changes.token;
  }

  stopWatching(driveId) {
    if (!this.intervals[driveId]) {
      return;
    }
    clearInterval(this.intervals[driveId]);
    this.intervals[driveId] = null;
  }

  @TelemetryMethodDisable()
  async run() {
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    const folders = await folderRegistryContainer.getFolders();
    for (const folderId in folders) {
      await this.startWatching(folders[folderId].id);
    }
  }
}
