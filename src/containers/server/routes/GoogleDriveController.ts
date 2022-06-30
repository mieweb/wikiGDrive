import {Controller, RouteErrorHandler, RouteGet, RouteParamPath, RouteResponse, RouteUse} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {findInTree, generateTreePath, outputDirectory, ShareErrorHandler} from './FolderController';

export class GoogleDriveController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private readonly authContainer) {
    super(subPath);
  }

  @RouteGet('/:driveId/:fileId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const transformedTree = await transformedFileSystem.readJson('.tree.json');

    const { child: local, folderId: parentFolderId } = findInTree(treeItem => treeItem.id === fileId, transformedTree, driveId);

    if (!local) {
      this.res.status(404).send('No local');
      return;
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const driveTree = await googleFileSystem.readJson('.tree.json');

    const filePath = local.path;

    this.res.setHeader('wgd-google-parent-id', parentFolderId);
    this.res.setHeader('wgd-google-id', local.id);
    this.res.setHeader('wgd-path', local.path);
    this.res.setHeader('wgd-file-name', local.fileName);
    this.res.setHeader('wgd-mime-type', local.mimeType);

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }
    if (await transformedFileSystem.isDirectory(filePath)) {
      let googleFolderFileSystem = googleFileSystem;
      const [file, drivePath] = generateTreePath(local.id, driveTree, 'id');
      if (file && drivePath) {
        googleFolderFileSystem = await googleFolderFileSystem.getSubFileService(drivePath);
      }

      await outputDirectory(this.res, local, await transformedFileSystem.getSubFileService(filePath), googleFolderFileSystem);

      return;
    } else {
      if (local.mimeType) {
        this.res.setHeader('Content-type', local.mimeType);
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      this.res.send(buffer);
      return;
    }
  }

}
