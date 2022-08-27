import {Container, ContainerEngine} from '../../ContainerEngine';
import winston from 'winston';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {fileURLToPath} from 'url';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {GoogleFile} from '../../model/GoogleFile';
import {GoogleTreeItem} from '../google_folder/GoogleFolderContainer';
import {findInTree} from '../server/routes/FolderController';
import {HasQuotaLimiter} from '../../google/AuthClient';

const __filename = fileURLToPath(import.meta.url);

export class WatchChangesContainer extends Container {
  private logger: winston.Logger;
  private auth: OAuth2Client & HasQuotaLimiter;
  private googleDriveService: GoogleDriveService;
  private lastToken: { [driveId: string]: string } = {};
  private intervals: { [driveId: string]: NodeJS.Timer } = {};

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    const googleApiContainer = <GoogleApiContainer>engine.getContainer('google_api');
    this.auth = googleApiContainer.getAuth();
    this.googleDriveService = new GoogleDriveService(this.logger);

    this.engine.subscribe('gdrive:changed', async (driveId, tree: GoogleTreeItem[]) => {
      const changes = await this.getChanges(driveId);
      const filteredChanges = [];
      for (const change of changes) {
        const leaf: GoogleTreeItem = findInTree((leaf => leaf['id'] === change.id), tree);

        if (!leaf) {
          if (!change.trashed) {
            filteredChanges.push(change);
          }
          continue;
        }

        if (leaf.version < change.version) {
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
  }

  async startWatching(driveId: string) {
    if (this.intervals[driveId]) {
      return;
    }
    this.lastToken[driveId] = await this.googleDriveService.getStartTrackToken(this.auth, driveId);
    this.intervals[driveId] = setInterval(async () => {
      try {
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
      } catch (err) {
        this.logger.error(err.message);
      }
    }, 3000);
  }

  stopWatching(driveId) {
    if (!this.intervals[driveId]) {
      return;
    }
    clearInterval(this.intervals[driveId]);
    this.intervals[driveId] = null;
  }

  async run() {
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    const folders = await folderRegistryContainer.getFolders();
    for (const folderId in folders) {
      if (folders[folderId]['kind'] === 'drive#drive') {
        await this.startWatching(folders[folderId].id);
      }
    }
  }
}
