import {Controller, RouteGet, RouteParamPath} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {LocalLinks} from '../../transform/LocalLinks';
import {findInTree, TreeItem} from './FolderController';

export class BackLinksController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private readonly authContainer) {
    super(subPath);
  }

  @RouteGet('/:driveId/:fileId')
  async getBackLinks(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const transformedTree = await transformedFileSystem.readJson('.tree.json');

    const localLinks = new LocalLinks(transformedFileSystem);
    await localLinks.load();

    const backLinkFileIds = localLinks.getBackLinks(fileId);
    const backlinks = [];
    for (const backLinkFileId of backLinkFileIds) {
      const obj = findInTree(node => node.id === backLinkFileId, transformedTree, driveId);
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
