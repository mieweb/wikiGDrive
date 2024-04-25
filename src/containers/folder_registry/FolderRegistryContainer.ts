import winston from 'winston';
import { fileURLToPath } from 'url';

import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine.ts';
import {FileId} from '../../model/model.ts';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer.ts';
import {GoogleDriveServiceError} from '../../google/driveFetch.ts';

const __filename = fileURLToPath(import.meta.url);

export interface Drive {
  id: FileId;
  name: string;
  kind: string;
  new?: boolean;
}

export interface Permission {
  id: string;
  type: 'user';
  role: 'reader';
  kind: string; // drive#permission
}

export interface Folder {
  id: FileId;
  name: string;
  new?: boolean;
  driveId?: FileId;
}

export interface FoldersMap {
  [id: string]: Folder;
}

export class FolderRegistryContainer extends Container {
  private logger: winston.Logger;
  private folders: FoldersMap;

  constructor(public readonly params: ContainerConfig) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });

    this.folders = await this.filesService.readJson('folders.json') || {};
    try {
      await this.refreshDrives();
    } catch (err) {
      this.logger.error(err.stack ? err.stack : err.message);
    }
  }

  async refreshDrives() {
    if (!this.engine.hasContainer('google_api')) {
      this.logger.warn('Not authenticated to Google API. Skipping drives refresh.');
      return;
    }

    const oldDrives = Object.values(await this.getFolders());

    const apiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
    const drives = await apiContainer.listDrives();

    for (const newDrive of drives) {
      if (!oldDrives.find(oldDrive => oldDrive.id === newDrive.id)) {
        try {
          await this.registerFolder(newDrive.id);
        } catch (err) {
          this.logger.error(err.stack ? err.stack : err.message);
        }
      }
    }
    for (const oldDrive of oldDrives) {
      if (!drives.find(newDrive => newDrive.id === oldDrive.id)) {
        await this.unregisterFolder(oldDrive.id);
      }
    }
  }

  async registerFolder(folderId: FileId): Promise<Folder> {
    if (this.folders[folderId]) {
      return this.folders[folderId];
    }

    const apiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
    const folder = await apiContainer.getDrive(folderId);
    if (!folder) {
      throw new GoogleDriveServiceError('Drive not shared with wikigdrive', {
        isQuotaError: false,
        status: 404
      });
    }

    this.folders[folderId] = {
      id: folder.id,
      name: folder.name,
      driveId: folder.id,
    };

    this.engine.emit(folderId, 'drive:register', this.folders[folderId]);

    await this.flushData();
    return Object.assign({}, folder, { new: true });
  }

  async unregisterFolder(folderId: FileId) {
    if (this.folders[folderId]) {
      this.logger.info('Unregistered folder: ' + folderId);
      delete this.folders[folderId];
      await this.flushData();
      this.engine.emit(folderId, 'drive:unregister', this.folders[folderId]);
    }
  }

  getFolders() {
    return this.folders;
  }

  async pruneFolder(folderId: FileId) {
    await this.unregisterFolder(folderId);
    await this.filesService.remove(folderId);
    await this.filesService.remove(folderId + '_transform');
  }

  async pruneTransformFolder(folderId: FileId) {
    await this.filesService.remove(folderId + '_transform');
  }

  async pruneGitFolder(folderId: FileId) {
    await this.filesService.remove(folderId + '_transform/.git');
  }

  async flushData() {
    await this.filesService.writeJson('folders.json', this.folders);
  }

  async run() {
    setInterval(async () => {
      try {
        await this.refreshDrives();
      } catch (err) {
        this.logger.error(err.stack ? err.stack : err.message);
      }
    }, 60*1000);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async rename(folderId: string, name: string) {
    if (this.folders[folderId]) {
      this.folders[folderId].name = name;
      await this.flushData();
    }
  }

  hasFolder(folderId: string) {
    return !!this.folders[folderId];
  }
}
