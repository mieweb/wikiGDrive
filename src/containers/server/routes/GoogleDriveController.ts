import process from 'node:process';

import {
  Controller,
  RouteErrorHandler,
  RouteGet,
  RouteParamPath,
  RouteParamUser,
  RouteResponse
} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {addPreviewUrl, getCachedChanges, outputDirectory, ShareErrorHandler} from './FolderController.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {getContentFileService} from '../../transform/utils.ts';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor.ts';
import {UserAuthClient} from '../../../google/AuthClient.ts';
import {filterParams} from '../../../google/driveFetch.ts';
import {GoogleDriveService} from '../../../google/GoogleDriveService.ts';
import {redirError} from '../auth.ts';

export class GoogleDriveController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId/share')
  async getShare(@RouteParamUser() user, @RouteParamPath('driveId') driveId: string) {
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(filterParams({
      shareDrive: 1,
      driveId: driveId !== 'none' ? (driveId || '') : '',
      instance: process.env.AUTH_INSTANCE
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
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(filterParams({
      uploadDrive: 1,
      driveId: driveId !== 'none' ? (driveId || '') : '',
      instance: process.env.AUTH_INSTANCE
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
  async getDocs(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string, @RouteParamUser() user) {
    if (!user?.google_access_token) {
      throw redirError(this.req, 'Not authenticated');
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();
    const [foundTreeItem] = await markdownTreeProcessor.findById(fileId);

    const contentDir = (userConfigService.config.transform_subdir || '').startsWith('/') ? userConfigService.config.transform_subdir : undefined;
    this.res.setHeader('wgd-content-dir', contentDir || '');
    this.res.setHeader('wgd-google-id', fileId);

    if (!foundTreeItem) {
      const googleDriveService = new GoogleDriveService(this.logger, null);
      const auth = {
        async getAccessToken(): Promise<string> {
          return user.google_access_token;
        }
      };
      try {
        const file = await googleDriveService.getFile(auth, fileId);
        if (file) {
          this.res.setHeader('wgd-google-parent-id', file.parentId || '');
          this.res.setHeader('wgd-google-version', file.version || '');
          this.res.setHeader('wgd-google-modified-time', file.modifiedTime || '');
          this.res.setHeader('wgd-mime-type', file.mimeType || '');
          this.res.setHeader('wgd-last-author', file.lastAuthor || '');
          this.res.setHeader('Content-type', file.mimeType);

          this.res.send('Not synced');
          return;
        }
      } catch (err) {
        if (err.status === 401) {
          throw redirError(this.req, err.message);
        }
      }

      this.res.status(404).send({ message: 'No local' });
      return;
    }

    const treeItem = addPreviewUrl(userConfigService.config.hugo_theme, driveId)(foundTreeItem);

    this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
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
      this.res.setHeader('wgd-git-attachments', String(change.attachments) || '0');
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
