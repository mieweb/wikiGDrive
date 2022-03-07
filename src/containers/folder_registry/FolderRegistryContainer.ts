import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {FileId} from '../../model/model';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {MimeTypes} from '../../model/GoogleFile';

export interface Drive {
  id: FileId;
  name: string;
  kind: string;
  new?: boolean;
}

export interface Folder {
  id: FileId;
  name: string;
  new?: boolean;
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
  }

  async registerFolder(folderId: FileId): Promise<Folder> {
    if (this.folders[folderId]) {
      return this.folders[folderId];
    }

    const apiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
    const folder = await apiContainer.getFolder(folderId);
    if (!folder && folder.mimeType !== MimeTypes.FOLDER_MIME) {
      throw new Error('Folder not shared with wikigdrive');
    }

    this.folders[folderId] = {
      id: folder.id,
      name: folder.name
    };
    await this.flushData();
    return Object.assign({}, folder, { new: true });
  }

  async unregisterFolder(folderId: FileId) {
    delete this.folders[folderId];
    await this.flushData();
  }

  getFolders() {
    return this.folders;
  }

  async pruneFolder(folderId: FileId) {
    await this.unregisterFolder(folderId);
    await this.filesService.remove(folderId);
    await this.filesService.remove(folderId + '_transform');
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async flushData() {
    await this.filesService.writeJson('folders.json', this.folders);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

}
