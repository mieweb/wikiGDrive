import {Controller, RouteErrorHandler, RouteGet, RouteParamPath, RouteResponse} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {outputDirectory, ShareErrorHandler} from './FolderController';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor';

export class GoogleDriveController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private readonly authContainer) {
    super(subPath);
  }

  @RouteGet('/:driveId/:fileId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getDocs(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = userConfigService.config.transform_subdir ? await transformedFileSystem.getSubFileService(userConfigService.config.transform_subdir) : transformedFileSystem;

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();
    const [treeItem] = await markdownTreeProcessor.findById(fileId);

    if (!treeItem) {
      this.res.status(404).send('No local');
      return;
    }

    const contentDir = userConfigService.config.transform_subdir ? '/' + userConfigService.config.transform_subdir : '/';

    this.res.setHeader('wgd-content-dir', contentDir);
    this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
    this.res.setHeader('wgd-google-id', treeItem.id || '');
    this.res.setHeader('wgd-google-version', treeItem.version || '');
    this.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
    this.res.setHeader('wgd-path', treeItem.path || '');
    this.res.setHeader('wgd-file-name', treeItem.fileName || '');
    this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');

    const filePath = contentDir + treeItem.path;
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
