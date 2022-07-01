import {Controller, RouteGet, RouteParamPath} from './Controller';
import {GitScanner} from '../../../git/GitScanner';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {FileContentService} from '../../../utils/FileContentService';

async function loadHugoThemes(filesService: FileContentService) {
  if (!await filesService.exists('hugo_themes.json')) {
    await filesService.writeJson('hugo_themes.json', [{
      id: 'ananke',
      name: 'Anake',
      url: 'https://github.com/budparr/gohugo-theme-ananke.git',
      preview_img: 'https://raw.githubusercontent.com/budparr/gohugo-theme-ananke/master/images/screenshot.png'
    }]);
  }
  return await filesService.readJson('hugo_themes.json');
}

export class DriveController extends Controller {
  constructor(subPath: string,
              private readonly filesService: FileContentService,
              private readonly folderRegistryContainer: FolderRegistryContainer) {
    super(subPath);
  }

  @RouteGet('/')
  async getDrives() {
    const folders = await this.folderRegistryContainer.getFolders();

    const retVal = [];
    for (const folderId in folders) {
      // const driveJobs = driveJobsMap[folderId] || { jobs: [] };
      const folder = folders[folderId];
      retVal.push({
        folderId,
        name: folder.name,
        // jobs_count: driveJobs.jobs.length
      });
    }
    return retVal;
  }

  @RouteGet('/:driveId')
  async getDrive(@RouteParamPath('driveId') driveId: string) {
    const folders = await this.folderRegistryContainer.getFolders();
    const drive = folders[driveId] || {};

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');

    const initialized = await gitScanner.isRepo();


    const transformedTree = (await transformedFileSystem.readJson('.tree.json')) || [];

    const tocFile = transformedTree.find(item => item.path === '/toc.md');
    const navFile = transformedTree.find(item => item.path === '/.navigation.md');

    const hugo_themes = await loadHugoThemes(this.filesService);

    return {
      ...drive,
      git: {
        initialized,
        public_key: await userConfigService.getDeployKey(),
        remote_branch: userConfig.remote_branch,
        remote_url: initialized ? await gitScanner.getRemoteUrl() : null,
      },
      tocFilePath: tocFile ? tocFile.path : null,
      navFilePath: navFile ? navFile.path : null,
      hugo_theme: userConfig.hugo_theme || {},
      hugo_themes
    };
  }

}
