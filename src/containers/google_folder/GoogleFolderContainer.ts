import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine';
import winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {QueueDownloader} from './QueueDownloader';
import {TaskFetchFolder} from './TaskFetchFolder';
import {MimeTypes} from '../../model/GoogleFile';
import {DateISO, FileId} from '../../model/model';
import {fileURLToPath} from 'url';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {GoogleTreeProcessor} from './GoogleTreeProcessor';
import {HasAccessToken} from '../../google/AuthClient';

const __filename = fileURLToPath(import.meta.url);

export interface GoogleTreeItem {
  id: FileId;
  name: string;
  mimeType: string;
  parentId: FileId;
  version: string;
  modifiedTime?: DateISO;
  children?: GoogleTreeItem[];
}

export class GoogleFolderContainer extends Container {
  private logger: winston.Logger;
  private googleDriveService: GoogleDriveService;
  private auth: HasAccessToken;
  private filterFilesIds: FileId[];
  private forceDownloadFilters: boolean;

  private progressNotifyCallback: ({total, completed}: { total?: number; completed?: number }) => void;

  constructor(public readonly params: ContainerConfig, public readonly paramsArr: ContainerConfigArr = {}) {
    super(params, paramsArr);
    this.filterFilesIds = paramsArr['filesIds'] || [];
    this.forceDownloadFilters = false;
  }

  setForceDownloadFilters(value: boolean) {
    this.forceDownloadFilters = value;
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.name });
    const googleApiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
    this.googleDriveService = new GoogleDriveService(this.logger, googleApiContainer.getQuotaLimiter());
    this.auth = googleApiContainer.getAuth();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async run() {
    const downloader = new QueueDownloader(this.logger);

    const filterFoldersIds: FileId[] = [];
    if (this.filterFilesIds.length > 0) {
      filterFoldersIds.push(this.params.folderId);
      await this.buildFolderFilter(this.filterFilesIds, filterFoldersIds);
    }

    downloader.onProgressNotify(({ total, completed }) => {
      if (this.progressNotifyCallback) {
        this.progressNotifyCallback({ total, completed });
      }
    });

    switch (this.params.cmd) {
      case 'pull': {
        const taskFetchFolder = new TaskFetchFolder(
          this.logger,
          this.googleDriveService,
          this.auth,
          this.filesService,
          {id: this.params.folderId, name: this.params.folderId, mimeType: MimeTypes.FOLDER_MIME},
          this.forceDownloadFilters,
          {filterFilesIds: this.filterFilesIds, filterFoldersIds}
        );
        downloader.addTask(taskFetchFolder);
      }
    }

    await downloader.finished();

    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    const folderData = await this.filesService.readJson('.folder.json');
    if (folderData?.name) {
      await folderRegistryContainer.rename(this.params.folderId, folderData.name);
    }

    const treeProcessor = new GoogleTreeProcessor(this.filesService);
    await treeProcessor.load();
    await treeProcessor.regenerateTree();
    await treeProcessor.save();

    this.engine.emit(this.params.folderId, 'gdrive:changed', null);
  }

  private async buildFolderFilter(filesIds: FileId[], folderFilterIds: FileId[]): Promise<void> {
    for (const fileId of filesIds) {
      const file = await this.googleDriveService.getFile(this.auth, fileId);
      if (!file.parentId || file.parentId === this.params.folderId) {
        continue;
      }
      if (folderFilterIds.indexOf(file.parentId) === -1) {
        folderFilterIds.push(file.parentId);
        await this.buildFolderFilter([file.parentId], folderFilterIds);
      }
    }
  }

  onProgressNotify(callback: ({total, completed}: { total?: number; completed?: number }) => void) {
    this.progressNotifyCallback = callback;
  }
}
