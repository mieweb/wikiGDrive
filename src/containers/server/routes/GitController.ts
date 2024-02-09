import {Controller, RouteGet, RouteParamBody, RouteParamPath, RouteParamUser, RoutePost, RouteUse} from './Controller.ts';
import {GitScanner} from '../../../git/GitScanner.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {initJob, JobManagerContainer} from '../../job/JobManagerContainer.ts';
import {ContainerEngine} from '../../../ContainerEngine.ts';

interface CommitPost {
  message: string;
  filePaths: string[];
  removeFilePaths: string[];
}

interface CmdPost {
  cmd: string;
}

export default class GitController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService,
              private jobManagerContainer: JobManagerContainer, private engine: ContainerEngine) {
    super(subPath);
  }

  @RouteUse('/:driveId/history')
  async getHistory(@RouteParamPath('driveId') driveId: string) {
    const filePath = this.req.originalUrl.replace('/api/git/' + driveId + '/history', '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(this.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    const history = await gitScanner.history(filePath, userConfig.remote_branch);

    return history;
  }

  @RouteUse('/:driveId/diff')
  async getDiff(@RouteParamPath('driveId') driveId: string) {
    const filePath = this.req.originalUrl.replace('/api/git/' + driveId + '/diff', '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(this.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const history = await gitScanner.diff(filePath);

    return history;
  }

  @RouteGet('/:driveId/commit')
  async getCommit(@RouteParamPath('driveId') driveId: string) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(this.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const changes = await gitScanner.changes();
    return { changes };
  }

  @RoutePost('/:driveId/commit')
  async postCommit(@RouteParamPath('driveId') driveId: string, @RouteParamBody() body: CommitPost, @RouteParamUser() user) {
    const message = body.message;
    const filePaths: string[] = Array.isArray(body.filePaths)
      ? body.filePaths
      : (body.filePaths ? [body.filePaths] : []);
    const removeFilePaths: string[] = Array.isArray(body.removeFilePaths)
      ? body.removeFilePaths
      : (body.removeFilePaths ? [body.removeFilePaths] : []);

    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_commit',
      title: 'Git Commit',
      payload: JSON.stringify({
        message, filePaths, removeFilePaths, user
      })
    });
    return { driveId, message };
  }

  @RoutePost('/:driveId/cmd')
  async postCmd(@RouteParamPath('driveId') driveId: string, @RouteParamBody() body: CmdPost) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(this.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const output = await gitScanner.cmd(body.cmd);
    return output;
  }

  @RoutePost('/:driveId/fetch')
  async fetch(@RouteParamPath('driveId') driveId: string) {
    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_fetch',
      title: 'Git Fetch'
    });
    return { driveId };
  }

  @RoutePost('/:driveId/pull')
  async pull(@RouteParamPath('driveId') driveId: string) {
    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_pull',
      title: 'Git Pull'
    });
    return { driveId };
  }

  @RoutePost('/:driveId/push')
  async push(@RouteParamPath('driveId') driveId: string) {
    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_push',
      title: 'Git Push'
    });

    return { driveId };
  }

  @RoutePost('/:driveId/reset_remote')
  async resetRemote(@RouteParamPath('driveId') driveId: string) {
    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_reset',
      title: 'Git Reset to Remote',
      payload: 'remote'
    });

    return { driveId, payload: 'remote'};
  }

  @RoutePost('/:driveId/reset_local')
  async resetLocal(@RouteParamPath('driveId') driveId: string) {
    await this.jobManagerContainer.schedule(driveId, {
      ...initJob(),
      type: 'git_reset',
      title: 'Git Reset to Local',
      payload: 'local'
    });

    return { driveId, payload: 'local'};
  }

  @RoutePost('/:driveId/remove_untracked')
  async removeUntracked(@RouteParamPath('driveId') driveId: string) {
    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(this.logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();
      await gitScanner.removeUntracked();

      return {};
    } catch (err) {
      this.logger.error(err.stack ? err.stack : err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

}
