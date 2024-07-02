import {Logger} from 'winston';
import {
  Controller,
  RouteErrorHandler,
  RouteGet,
  RouteParamQuery,
  RouteResponse
} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {ShareErrorHandler} from './FolderController.ts';
import {filterParams} from '../../../google/driveFetch.ts';
import {GoogleDriveService} from '../../../google/GoogleDriveService.ts';
import {GoogleApiContainer} from '../../google_api/GoogleApiContainer.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {UserAuthClient} from '../../../google/AuthClient.ts';
import {getContentFileService} from '../../transform/utils.ts';

export class DriveUiController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger,
              private filesService: FileContentService, private googleApiContainer: GoogleApiContainer) {
    super(subPath);
  }

  @RouteGet('/')
  @RouteErrorHandler(new ShareErrorHandler())
  @RouteResponse('stream')
  async getFolder(@RouteParamQuery('state') state: string) {
    if (!state) {
      throw new Error('No state query parameter');
    }
    const obj = JSON.parse(state);
    const action = obj.action;
    const ids = obj.ids;

    if (action === 'open' && ids.length > 0) {
      const fileId = ids[0];

      const googleDriveService = new GoogleDriveService(this.logger, this.googleApiContainer.getQuotaLimiter());
      const auth = this.googleApiContainer.getAuth();

      const drives = await this.googleApiContainer.listDrives();
      const driveIds = drives.map(drive => drive.id);

      let dir = await googleDriveService.getFile(auth, fileId);
      while (dir.parentId) {
        dir = await googleDriveService.getFile(auth, dir.parentId);
      }

      if (!dir.id || !driveIds.includes(dir.id)) {
        this.res.send({ not_shared: 1 });
        return;
      }

      const driveId = dir.id;
      const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
      const userConfigService = new UserConfigService(googleFileSystem);
      await userConfigService.load();
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

      const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
      await markdownTreeProcessor.load();
      const [file, drivePath] = await markdownTreeProcessor.findById(fileId);
      if (file && drivePath) {
        if (userConfigService.config.transform_subdir.length > 0) {
          const transformSubDir = (!userConfigService.config.transform_subdir.startsWith('/') ? '/' : '')
            + userConfigService.config.transform_subdir;
          this.res.redirect(`/drive/${driveId}${transformSubDir}/${drivePath}`);
        } else {
          this.res.redirect(`/drive/${driveId}`);
        }
        return;
      } else {
        this.res.redirect(`/drive/${driveId}`);
      }

    } else {
      this.res.send({ invalid_action: 1 });
      return;
    }
  }

  @RouteGet('/installed')
  @RouteErrorHandler(new ShareErrorHandler())
  async getInstalled() {
    return { installed: true };
  }

  @RouteGet('/install')
  @RouteErrorHandler(new ShareErrorHandler())
  @RouteResponse('stream')
  async getInstall() {
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(filterParams({
      driveui: 1,
      instance: process.env.AUTH_INSTANCE
      // driveId: driveId !== 'none' ? (driveId || '') : '',
      // redirectTo
    })).toString();

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    const authUrl = await authClient.getWebDriveInstallUrl(`${serverUrl}/auth`, state);
    if (process.env.VERSION === 'dev') {
      console.debug(authUrl);
    }

    this.res.redirect(authUrl);
  }

}
