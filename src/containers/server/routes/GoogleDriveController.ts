import {Controller, RouteErrorHandler, RouteGet, RouteParamPath, RouteResponse, RouteUse} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {findInTree, outputDirectory, ShareErrorHandler} from './FolderController';

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

    const treeItem = findInTree(treeItem => treeItem['id'] === fileId, transformedTree);

    if (!treeItem) {
      this.res.status(404).send('No local');
      return;
    }

    const filePath = treeItem.path;

    this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
    this.res.setHeader('wgd-google-id', treeItem.id || '');
    this.res.setHeader('wgd-google-version', treeItem.version || '');
    this.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
    this.res.setHeader('wgd-path', treeItem.path || '');
    this.res.setHeader('wgd-file-name', treeItem.fileName || '');
    this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }
    if (await transformedFileSystem.isDirectory(filePath)) {
      await outputDirectory(this.res, treeItem);
      return;
    } else {
      if (treeItem.mimeType) {
        this.res.setHeader('Content-type', treeItem.mimeType);
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      this.res.send(buffer);
      return;
    }
  }

}
