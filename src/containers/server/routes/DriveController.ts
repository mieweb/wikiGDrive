import {Controller, type ControllerCallContext, RouteGet, RouteResponse} from './Controller.ts';
import {GitScanner} from '../../../git/GitScanner.ts';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {GoogleDriveService} from '../../../google/GoogleDriveService.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {AuthConfig} from '../../../model/AccountJson.ts';
import {googleMimeToExt} from '../../transform/TaskLocalFileTransform.ts';
import {Container} from '../../../ContainerEngine.ts';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor.ts';
import {getContentFileService} from '../../transform/utils.ts';
import {redirError} from '../auth.ts';

export class DriveController extends Controller {
  constructor(subPath: string,
              private readonly filesService: FileContentService,
              private readonly folderRegistryContainer: FolderRegistryContainer,
              private readonly authContainer: Container) {
    super(subPath);
  }

  @RouteGet('/')
  async getDrives(ctx: ControllerCallContext) {
    const user = await ctx.routeParamUser();

    if (!user?.google_access_token) {
      throw redirError(ctx.req, 'Not authenticated');
    }

    const folders = await this.folderRegistryContainer.getFolders();

    const googleDriveService = new GoogleDriveService(ctx.logger, null);
    const drives = await googleDriveService.listDrives(user.google_access_token);
    return drives.map(drive => {
      return {
        id: drive.id,
        folderId: drive.id,
        name: drive.name,
        exists: !!folders[drive.id]
      };
    });
  }

  @RouteGet('/:driveId')
  async getDrive(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    const folders = await this.folderRegistryContainer.getFolders();
    const drive = folders[driveId] || await this.folderRegistryContainer.registerFolder(driveId);

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();

    const transformedTree = markdownTreeProcessor.getTree();

    const tocFile = transformedTree.find(item => item.path === '/toc.md');
    const navFile = transformedTree.find(item => item.path === '/.navigation.md' || item.path === '/navigation.md');

    let tocFilePath = null;
    let navFilePath = null;

    if (userConfigService.config.transform_subdir && userConfigService.config.transform_subdir.length > 0) {
      const contentPrefix = (!userConfigService.config.transform_subdir.startsWith('/') ? '/' : '')
        + userConfigService.config.transform_subdir;
      tocFilePath = tocFile ? contentPrefix + tocFile.path : null;
      navFilePath = navFile ? contentPrefix + navFile.path : null;
    }

    return {
      ...drive,
      gitStats: await gitScanner.getStats(userConfig),
      tocFilePath,
      navFilePath
    };
  }

  @RouteGet('/:driveId/file/(:fileId).odt')
  @RouteResponse('stream', {}, 'application/vnd.oasis.opendocument.text')
  async downloadOdt(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const fileId: string = await ctx.routeParamPath('fileId');

    try {
      const driveFileSystem = await this.filesService.getSubFileService(driveId, '');

      const googleTreeProcessor = new GoogleTreeProcessor(driveFileSystem);
      await googleTreeProcessor.load();
      const [file, drivePath] = await googleTreeProcessor.findById(fileId);
      if (file && drivePath) {
        const odtPath = drivePath + '.odt';
        if (await driveFileSystem.exists(odtPath)) {
          driveFileSystem.createReadStream(odtPath).pipe(ctx.res);
          return;
        }
      }

      ctx.res.status(404).json({});
    } catch (err) {
      if (err.message === 'Drive not shared with wikigdrive') {
        const authConfig: AuthConfig = this.authContainer['authConfig'];
        ctx.res.status(404).json({ not_registered: true, share_email: authConfig.share_email });
        return;
      }
      throw err;
    }
  }

  @RouteGet('/:driveId/transformed/(:fileId)')
  @RouteResponse('stream', {}, 'image')
  async downloadTransformed(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const fileId: string = await ctx.routeParamPath('fileId');

    try {
      const driveFileSystem = await this.filesService.getSubFileService(driveId, '');

      const googleTreeProcessor = new GoogleTreeProcessor(driveFileSystem);
      await googleTreeProcessor.load();
      const [file, drivePath] = await googleTreeProcessor.findById(fileId);
      if (file && drivePath) {
        const filePath = `${drivePath}.${googleMimeToExt(file.mimeType, '')}`;
        if (await driveFileSystem.exists(filePath)) {
          ctx.res.header('Content-Disposition', `attachment; filename="${file['name']}.${googleMimeToExt(file.mimeType, '')}"`);
          driveFileSystem.createReadStream(filePath).pipe(ctx.res);
          return;
        }
      }

      ctx.res.status(404).json({});
    } catch (err) {
      if (err.message === 'Drive not shared with wikigdrive') {
        const authConfig: AuthConfig = this.authContainer['authConfig'];
        ctx.res.status(404).json({ not_registered: true, share_email: authConfig.share_email });
        return;
      }
      throw err;
    }
  }

}
