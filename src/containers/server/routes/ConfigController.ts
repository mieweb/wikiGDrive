import yaml from 'js-yaml';

import {Controller, type ControllerCallContext, RouteGet, RoutePost, RoutePut} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {GitScanner} from '../../../git/GitScanner.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer.ts';
import {ContainerEngine} from '../../../ContainerEngine.ts';

export interface ConfigBody {
  config: {
    remote_branch: string;
    config_toml?: string;
    transform_subdir?: string;
    rewrite_rules_yaml?: string;
    preview_rewrite_rule?: string;
    companion_files_rule?: string;
    hugo_theme: HugoTheme;
    auto_sync: boolean;
    use_google_markdowns: boolean;
    fm_without_version: boolean;
    actions_yaml?: string;
  };
  remote_url: string;
}

export interface HugoTheme {
  id: string;
  name: string;
  url: string;
  preview_img: string;
}

async function loadHugoThemes(filesService: FileContentService) {
  if (!await filesService.exists('hugo_themes.json')) {
    await filesService.writeJson('hugo_themes.json', [{
      id: 'ananke',
      name: 'Anake',
      url: 'https://github.com/budparr/gohugo-theme-ananke.git',
      preview_img: 'https://raw.githubusercontent.com/budparr/gohugo-theme-ananke/master/images/screenshot.png'
    }]);
  }
  return await filesService.readJson('hugo_themes.json');
}

export class ConfigController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private folderRegistryContainer: FolderRegistryContainer, private engine: ContainerEngine) {
    super(subPath);
  }

  async returnConfig(userConfigService: UserConfigService) {
    const hugo_themes = await loadHugoThemes(this.filesService);

    return {
      config: { ...userConfigService.config, rewrite_rules_yaml: yaml.dump(userConfigService.config.rewrite_rules || []) },
      public_key: await userConfigService.getDeployKey(),
      hugo_themes
    };
  }

  @RouteGet('/:driveId')
  async getConfig(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    return {
      ...await this.returnConfig(userConfigService),
      remote_url: await gitScanner.getRemoteUrl()
    };
  }

  @RoutePut('/:driveId')
  async putConfig(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const body: ConfigBody = await ctx.routeParamBody();

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();
    await gitScanner.setSafeDirectory();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    if (body.config?.remote_branch) {
      userConfigService.config.remote_branch = body.config?.remote_branch || 'main';
    }
    if (body.config?.hugo_theme) {
      userConfigService.config.hugo_theme = body.config?.hugo_theme;
    }
    if (body.config?.config_toml) {
      userConfigService.config.config_toml = body.config?.config_toml;
    }
    if (body.config?.rewrite_rules_yaml) {
      userConfigService.config.rewrite_rules = yaml.load(body.config?.rewrite_rules_yaml);
    }
    if (body.config?.preview_rewrite_rule) {
      userConfigService.config.preview_rewrite_rule = body.config?.preview_rewrite_rule;
    }
    if (body.config?.companion_files_rule) {
      userConfigService.config.companion_files_rule = body.config?.companion_files_rule;
    }
    let modified = false;
    if ('string' === typeof body.config?.transform_subdir) {
      let trimmed = body.config?.transform_subdir.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('/')) {
        trimmed = '/' + trimmed;
      }
      if (userConfigService.config.transform_subdir !== trimmed) {
        modified = true;
      }
      userConfigService.config.transform_subdir = trimmed;
    }
    if (body.config?.actions_yaml) {
      userConfigService.config.actions_yaml = body.config?.actions_yaml;
    }
    userConfigService.config.auto_sync = !!body.config?.auto_sync;
    userConfigService.config.use_google_markdowns = !!body.config?.use_google_markdowns;
    userConfigService.config.fm_without_version = !!body.config?.fm_without_version;

    await userConfigService.save();

    if (body.remote_url) {
      await gitScanner.setRemoteUrl(body.remote_url);
    } else
    if (body.remote_url === '') {
      await gitScanner.setRemoteUrl('');
    }

    if (modified) {
      this.engine.emit(driveId, 'toasts:added', {
        title: 'Config modified',
        type: 'tree:changed'
      });
    }

    return {
      ...await this.returnConfig(userConfigService),
      remote_url: await gitScanner.getRemoteUrl()
    };
  }

  @RoutePost('/:driveId/regenerate_key')
  async regenerateKey(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    await userConfigService.genKeys(true);

    return {
      ...await this.returnConfig(userConfigService),
      remote_url: await gitScanner.getRemoteUrl()
    };
  }

  @RoutePost('/:driveId/prune_transform')
  async pruneTransform(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    await this.folderRegistryContainer.pruneTransformFolder(driveId);
  }

  @RoutePost('/:driveId/prune_all')
  async pruneAll(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    await this.folderRegistryContainer.pruneFolder(driveId);
  }

  @RoutePost('/:driveId/prune_git')
  async pruneGit(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    await this.folderRegistryContainer.pruneGitFolder(driveId);
  }

}
