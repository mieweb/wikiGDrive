import {Controller, RouteGet, RouteParamBody, RouteParamPath, RoutePut} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {GitScanner} from '../../../git/GitScanner';
import {UserConfigService} from '../../google_folder/UserConfigService';

interface ConfigBody {
  remote_branch: string;
  remote_url: string;
  hugo_theme: HugoTheme;
  hugo_themes: HugoTheme[];
  config_toml?: string;
}

export interface HugoTheme {
  id: string;
  name: string;
  url: string;
  preview_img: string;
}

export class ConfigController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  async getConfig(@RouteParamPath('driveId') driveId: string) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    return {
      ...userConfigService.config,
      remote_url: await gitScanner.getRemoteUrl()
    };
  }

  @RoutePut('/:driveId')
  async putConfig(@RouteParamPath('driveId') driveId: string, @RouteParamBody() body: ConfigBody) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    if (body.remote_branch) {
      userConfigService.config.remote_branch = body.remote_branch || 'master';
    }
    if (body.hugo_theme) {
      userConfigService.config.hugo_theme = body.hugo_theme;
    }
    if (body.config_toml) {
      userConfigService.config.config_toml = body.config_toml;
    }

    await userConfigService.save();

    if (body.remote_url) {
      await gitScanner.setRemoteUrl(body.remote_url);
    }
    return {};
  }

}
