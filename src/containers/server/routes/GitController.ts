import {Controller, type ControllerCallContext, RouteGet, RoutePost, RouteUse} from './Controller.ts';
import {GitScanner} from '../../../git/GitScanner.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {initJob, JobManagerContainer} from '../../job/JobManagerContainer.ts';
import {ContainerEngine} from '../../../ContainerEngine.ts';

interface CommitPost {
  message: string;
  filePaths: string[];
}

interface CmdPost {
  cmd: string;
  arg?: string;
}

interface RemovePath {
  filePath: string;
}

export default class GitController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService,
              private jobManagerContainer: JobManagerContainer, private engine: ContainerEngine) {
    super(subPath);
  }

  @RouteUse('/:driveId/history')
  async getHistory(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    const filePath = ctx.req.originalUrl.replace('/api/git/' + driveId + '/history', '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    const history = await gitScanner.history(filePath, userConfig.remote_branch);

    return history;
  }

  @RouteUse('/:driveId/diff')
  async getDiff(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    const filePath = ctx.req.originalUrl.replace('/api/git/' + driveId + '/diff', '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const history = await gitScanner.diff(filePath);

    return history;
  }

  @RouteGet('/:driveId/commit')
  async getCommit(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const changes = await gitScanner.changes();
    return { changes };
  }

  @RoutePost('/:driveId/commit')
  async postCommit(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const body: CommitPost = await ctx.routeParamBody();
    const user = await ctx.routeParamUser();

    const message = body.message;
    const filePaths: string[] = Array.isArray(body.filePaths)
      ? body.filePaths
      : (body.filePaths ? [body.filePaths] : []);

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_commit',
      title: 'Git Commit',
      payload: JSON.stringify({
        message, filePaths, user
      })
    });
    return { driveId, message };
  }

  @RoutePost('/:driveId/cmd')
  async postCmd(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const body: CmdPost = await ctx.routeParamBody();

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const output = await gitScanner.executer.cmd(body.cmd, body.arg || '');
    return output;
  }

  @RoutePost('/:driveId/fetch')
  async fetch(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_fetch',
      title: 'Git Fetch'
    });
    return { driveId };
  }

  @RoutePost('/:driveId/pull')
  async pull(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_pull',
      title: 'Git Pull'
    });
    return { driveId };
  }

  @RoutePost('/:driveId/push')
  async push(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_push',
      title: 'Git Push'
    });

    return { driveId };
  }

  @RoutePost('/:driveId/reset_remote')
  async resetRemote(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_reset',
      title: 'Git Reset to Remote',
      payload: 'remote'
    });

    return { driveId, payload: 'remote'};
  }

  @RoutePost('/:driveId/reset_local')
  async resetLocal(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_reset',
      title: 'Git Reset to Local',
      payload: 'local'
    });

    return { driveId, payload: 'local'};
  }

  @RoutePost('/:driveId/remove_untracked')
  async removeUntracked(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');

    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();
      await gitScanner.removeUntracked();

      return {};
    } catch (err) {
      ctx.logger.error(err.stack ? err.stack : err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

  @RoutePost('/:driveId/remove_cached')
  async removeCached(ctx: ControllerCallContext) {
    const driveId: string = await ctx.routeParamPath('driveId');
    const body: RemovePath = await ctx.routeParamBody();

    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(ctx.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();
      await gitScanner.removeCached(body.filePath);

      return {};
    } catch (err) {
      ctx.logger.error(err.stack ? err.stack : err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

}
