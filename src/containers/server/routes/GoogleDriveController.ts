import {
  Controller,
  RouteErrorHandler,
  RouteGet,
  RouteParamPath,
  RouteParamUser,
  RoutePost,
  RouteResponse
} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {addPreviewUrl, getCachedChanges, outputDirectory, ShareErrorHandler} from './FolderController';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor';
import {getContentFileService} from '../../transform/utils';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor';
import {GoogleApiContainer} from '../../google_api/GoogleApiContainer';
import {GoogleDriveService} from '../../../google/GoogleDriveService';
import {UserAuthClient} from '../../../google/AuthClient';
import {filterParams} from '../../../google/driveFetch';

export class GoogleDriveController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId/share')
  async getShare(@RouteParamUser() user, @RouteParamPath('driveId') driveId: string) {
    const serverUrl = process.env.DOMAIN;

    const state = new URLSearchParams(filterParams({
      shareDrive: 1,
      driveId: driveId !== 'none' ? (driveId || '') : ''
    })).toString();

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    const shareUrl = await authClient.getWebDriveShareUrl(`${serverUrl}/auth`, state);
    if (process.env.VERSION === 'dev') {
      console.debug(shareUrl);
    }

    return { shareUrl };
  }

  @RouteGet('/:driveId/upload')
  async getUpload(@RouteParamUser() user, @RouteParamPath('driveId') driveId: string) {
    const serverUrl = process.env.DOMAIN;

    const state = new URLSearchParams(filterParams({
      uploadDrive: 1,
      driveId: driveId !== 'none' ? (driveId || '') : ''
    })).toString();

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    const shareUrl = await authClient.getUploadDriveUrl(`${serverUrl}/auth`, state);
    if (process.env.VERSION === 'dev') {
      console.debug(shareUrl);
    }

    return { shareUrl };
  }

  @RouteGet('/:driveId/:fileId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getDocs(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();
    const [foundTreeItem] = await markdownTreeProcessor.findById(fileId);

    if (!foundTreeItem) {
      this.res.status(404).send({ message: 'No local' });
      return;
    }

    const treeItem = addPreviewUrl(userConfigService.config.hugo_theme, driveId)(foundTreeItem);

    const contentDir = (userConfigService.config.transform_subdir || '').startsWith('/') ? userConfigService.config.transform_subdir : undefined;

    this.res.setHeader('wgd-content-dir', contentDir || '');
    this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
    this.res.setHeader('wgd-google-id', treeItem.id || '');
    this.res.setHeader('wgd-google-version', treeItem.version || '');
    this.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
    this.res.setHeader('wgd-path', treeItem.path || '');
    this.res.setHeader('wgd-file-name', treeItem.fileName || '');
    this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');
    this.res.setHeader('wgd-preview-url', treeItem.previewUrl || '');
    this.res.setHeader('wgd-last-author', treeItem.lastAuthor || '');

    if (!contentDir) {
      this.res.status(404).send('Content subdirectory must be set and start with /');
      return;
    }

    const treeProcessor = new GoogleTreeProcessor(googleFileSystem);
    await treeProcessor.load();
    const [leaf] = await treeProcessor.findById(foundTreeItem.id);

    if (leaf) {
      this.res.setHeader('wgd-synced-version', leaf.version || '');
      this.res.setHeader('wgd-synced-modified-time', leaf.modifiedTime || '');
    }

    const changes = await getCachedChanges(this.logger, transformedFileSystem, contentFileService, googleFileSystem);
    const change = changes.find(change => change.path === (contentDir.substring(1) + treeItem.path).replace(/^\//, ''));
    if (change) {
      if (change.state.isNew) {
        treeItem['status'] = 'N';
      } else
      if (change.state.isModified) {
        treeItem['status'] = 'M';
      } else
      if (change.state.isDeleted) {
        treeItem['status'] = 'D';
      }
    }
    this.res.setHeader('wgd-git-status', treeItem['status'] || '');

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
