import process from 'node:process';

import {
  Controller, type ControllerCallContext,
  RouteErrorHandler,
  RouteGet,
  RouteParamPath,
  RouteParamUser,
  RouteResponse
} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {convertToPreviewUrl, getCachedChanges, outputDirectory, ShareErrorHandler} from './FolderController.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {getContentFileService} from '../../transform/utils.ts';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor.ts';
import {UserAuthClient} from '../../../google/AuthClient.ts';
import {filterParams} from '../../../google/driveFetch.ts';
import {GoogleDriveService} from '../../../google/GoogleDriveService.ts';
import {redirError} from '../auth.ts';
import {LocalLog} from '../../transform/LocalLog.ts';

export class GoogleDriveController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId/share')
  async getShare(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
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
  async getUpload(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
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
  async getDocs(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const fileId: string = await ctx.routeParamPath('fileId');
    const user = await ctx.routeParamUser();

    if (!user?.google_access_token) {
      throw redirError(ctx.req, 'Not authenticated');
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    const localLog = new LocalLog(contentFileService);
    await localLog.load();
    const logRow = localLog.findLastFile(fileId);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();
    const [foundTreeItem] = await markdownTreeProcessor.findByPath(logRow?.filePath);

    const contentDir = (userConfigService.config.transform_subdir || '').startsWith('/') ? userConfigService.config.transform_subdir : undefined;
    ctx.res.setHeader('wgd-content-dir', contentDir || '');
    ctx.res.setHeader('wgd-google-id', fileId);

    if (!foundTreeItem) {
      const googleDriveService = new GoogleDriveService(ctx.logger, null);
      const auth = {
        async getAccessToken(): Promise<string> {
          return user.google_access_token;
        }
      };
      try {
        const file = await googleDriveService.getFile(auth, fileId);
        if (file) {
          ctx.res.setHeader('wgd-google-parent-id', file.parentId || '');
          ctx.res.setHeader('wgd-google-version', file.version || '');
          ctx.res.setHeader('wgd-google-modified-time', file.modifiedTime || '');
          ctx.res.setHeader('wgd-mime-type', file.mimeType || '');
          ctx.res.setHeader('wgd-last-author', file.lastAuthor || '');
          ctx.res.setHeader('Content-type', file.mimeType);

          ctx.res.send('Not synced');
          return;
        }
      } catch (err) {
        if (err.status === 401) {
          throw redirError(ctx.req, err.message);
        }
      }

      ctx.res.status(404).send({ message: 'No local' });
      return;
    }

    const treeItem = convertToPreviewUrl(userConfigService.config.preview_rewrite_rule, driveId)(foundTreeItem);

    ctx.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
    ctx.res.setHeader('wgd-google-version', treeItem.version || '');
    ctx.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
    ctx.res.setHeader('wgd-path', treeItem.path || '');
    ctx.res.setHeader('wgd-file-name', treeItem.fileName || '');
    ctx.res.setHeader('wgd-mime-type', treeItem.mimeType || '');
    ctx.res.setHeader('wgd-preview-url', treeItem.previewUrl || '');
    ctx.res.setHeader('wgd-last-author', treeItem.lastAuthor || '');

    if (!contentDir) {
      ctx.res.status(404).send('Content subdirectory must be set and start with /');
      return;
    }

    const treeProcessor = new GoogleTreeProcessor(googleFileSystem);
    await treeProcessor.load();
    const [leaf] = await treeProcessor.findById(foundTreeItem.id);

    if (leaf) {
      ctx.res.setHeader('wgd-synced-version', leaf.version || '');
      ctx.res.setHeader('wgd-synced-modified-time', leaf.modifiedTime || '');
    }

    const changes = await getCachedChanges(ctx.logger, transformedFileSystem, contentFileService, googleFileSystem);
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
      ctx.res.setHeader('wgd-git-attachments', String(change.attachments) || '0');
    }
    ctx.res.setHeader('wgd-git-status', treeItem['status'] || '');

    const filePath = contentDir + treeItem.path;
    if (!await transformedFileSystem.exists(filePath)) {
      ctx.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }
    if (await transformedFileSystem.isDirectory(filePath)) {
      await outputDirectory(ctx.res, treeItem);
      return;
    } else {
      if (treeItem.mimeType) {
        ctx.res.setHeader('Content-type', treeItem.mimeType);
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      ctx.res.send(buffer);
      return;
    }
  }

}
