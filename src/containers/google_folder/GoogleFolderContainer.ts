import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {GoogleDriveService, ListContext} from '../../google/GoogleDriveService';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {QueueDownloader} from './QueueDownloader';
import {TaskFetchFolder} from './TaskFetchFolder';
import {MimeTypes} from '../../model/GoogleFile';
import {GoogleFilesScanner} from '../transform/GoogleFilesScanner';
import {FileContentService} from '../../utils/FileContentService';
import {FileId} from '../../model/model';

export class GoogleFolderContainer extends Container {
  private logger: winston.Logger;
  private googleDriveService: GoogleDriveService;
  private auth: OAuth2Client;
  private drive_id: string;
  private filterFilesIds: FileId[];

  constructor(public readonly params: ContainerConfig, public readonly paramsArr: ContainerConfigArr = {}) {
    super(params, paramsArr);
    this.filterFilesIds = paramsArr['filesIds'] || [];
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
    this.googleDriveService = new GoogleDriveService(this.logger);
    const googleApiContainer: GoogleApiContainer = <GoogleApiContainer>this.engine.getContainer('google_api');
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

    switch (this.params.cmd) {
      case 'pull':
        downloader.addTask(new TaskFetchFolder(
          this.logger,
          this.googleDriveService,
          this.auth,
          this.filesService,
        { id: this.params.folderId, name: this.params.folderId, mimeType: MimeTypes.FOLDER_MIME },
          { filterFilesIds: this.filterFilesIds, filterFoldersIds}
        ));
    }

    await downloader.finished();
    await this.filesService.writeJson('.drive.json', await this.googleDriveService.getFile(this.auth, this.params.folderId));

    const tree = await this.regenerateTree(this.filesService);
    await this.filesService.writeJson('.tree.json', tree);
  }

  async regenerateTree(filesService: FileContentService, parentId?: string) {
    const scanner = new GoogleFilesScanner();
    const files = await scanner.scan(filesService);
    const retVal = [];
    for (const file of files) {
      if (file.mimeType === MimeTypes.FOLDER_MIME) {
        const subFileService = await filesService.getSubFileService(file.id);
        const item = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parentId,
          children: await this.regenerateTree(subFileService, file.id)
        };
        retVal.push(item);
      } else {
        const item = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parentId
        };
        retVal.push(item);
      }
    }
    return retVal;
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
}
