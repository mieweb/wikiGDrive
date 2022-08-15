import {Controller, RouteGet, RouteParamPath} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {LocalLinks} from '../../transform/LocalLinks';
import {findInTree} from './FolderController';
import {UserConfigService} from '../../google_folder/UserConfigService';

export class BackLinksController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId/:fileId')
  async getBackLinks(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = userConfigService.config.transform_subdir ? await transformedFileSystem.getSubFileService(userConfigService.config.transform_subdir) : transformedFileSystem;

    const transformedTree = await contentFileService.readJson('.tree.json');

    const localLinks = new LocalLinks(contentFileService);
    await localLinks.load();

    const backLinkFileIds = localLinks.getBackLinks(fileId);
    const backlinks = [];
    for (const backLinkFileId of backLinkFileIds) {
      const obj = findInTree(node => node['id'] === backLinkFileId, transformedTree);
      if (obj) {
        backlinks.push({
          folderId: obj.folderId,
          fileId: backLinkFileId,
          path: obj.child.path,
          name: obj.child.name
        });
      }
    }

    return backlinks;
  }

}
