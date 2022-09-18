import {Controller, RouteGet, RouteParamPath, RouteParamUser} from './Controller';
import {GitScanner} from '../../../git/GitScanner';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {FileContentService} from '../../../utils/FileContentService';
import {GoogleDriveService} from '../../../google/GoogleDriveService';
import {GoogleAuthService} from '../../../google/GoogleAuthService';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor';

export class DriveController extends Controller {
  constructor(subPath: string,
              private readonly filesService: FileContentService,
              private readonly folderRegistryContainer: FolderRegistryContainer) {
    super(subPath);
  }

  @RouteGet('/')
  async getDrives(@RouteParamUser() user) {
    const folders = await this.folderRegistryContainer.getFolders();

    const googleDriveService = new GoogleDriveService(this.logger);
    const googleAuthService = new GoogleAuthService();
    const googleUserAuth = await googleAuthService.authorizeUserAccount(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    googleUserAuth.setCredentials({ access_token: user.google_access_token, refresh_token: user.google_refresh_token });

    const drives = await googleDriveService.listDrives(googleUserAuth);
    return drives.map(drive => {
      return {
        folderId: drive.id,
        name: drive.name,
        exists: folders[drive.id]
      };
    });
  }

  @RouteGet('/:driveId')
  async getDrive(@RouteParamPath('driveId') driveId: string) {
    const folders = await this.folderRegistryContainer.getFolders();
    const drive = folders[driveId] || await this.folderRegistryContainer.registerFolder(driveId);

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const initialized = await gitScanner.isRepo();

    const contentFileService = userConfigService.config.transform_subdir ? await transformedFileSystem.getSubFileService(userConfigService.config.transform_subdir) : transformedFileSystem;

    const googleTreeProcessor = new GoogleTreeProcessor(contentFileService);
    await googleTreeProcessor.load();

    const transformedTree = googleTreeProcessor.getTree();

    const tocFile = transformedTree.find(item => item.path === '/toc.md');
    const navFile = transformedTree.find(item => item.path === '/.navigation.md');

    const contentPrefix = userConfigService.config.transform_subdir ? `/${userConfigService.config.transform_subdir}` : '';

    return {
      ...drive,
      git: {
        initialized,
        remote_branch: userConfig.remote_branch,
        remote_url: initialized ? await gitScanner.getRemoteUrl() : null
      },
      tocFilePath: tocFile ? contentPrefix + tocFile.path : null,
      navFilePath: navFile ? contentPrefix + navFile.path : null
    };
  }

}
