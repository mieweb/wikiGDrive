import {Controller, RouteGet, RouteParamBody, RouteParamPath, RouteParamUser, RoutePost, RouteUse} from './Controller';
import {GitScanner} from '../../../git/GitScanner';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {FileContentService} from '../../../utils/FileContentService';

interface CommitPost {
  message: string;
  filePath: string[];
}

export default class GitController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteUse('/:driveId/history')
  async getHistory(@RouteParamPath('driveId') driveId: string) {
    const filePath = this.req.originalUrl.replace('/api/git/' + driveId + '/history', '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    const history = await gitScanner.history(filePath);

    return history;
  }

  @RouteGet('/:driveId/commit')
  async getCommit(@RouteParamPath('driveId') driveId: string) {
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');

    const changes = await gitScanner.changes();
    return { changes };
  }

  @RoutePost('/:driveId/commit')
  async postCommit(@RouteParamPath('driveId') driveId: string, @RouteParamBody() body: CommitPost, @RouteParamUser() user) {
    const message = body.message;
    const filePaths: string[] = Array.isArray(body.filePath) ? body.filePath : [body.filePath];

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');

    const transformPaths = [];

    for (const filePath of filePaths) {
      /*
        const [file, transformPath] = generateTreePath(fileId, transformedTree, 'name');
        let author = '';
        if (file && transformPath) {
          const yamlContent = await transformedFileSystem.readFile(transformPath);
          const directoryScanner = new DirectoryScanner();
          const file = await directoryScanner.parseMarkdown(yamlContent, transformPath);
          if (file.type === 'md') {
            author = file.lastAuthor;
          }
        }
      */
      transformPaths.push(filePath);
    }

    await gitScanner.commit(message, transformPaths, user);

    return {};
  }

  @RoutePost('/:driveId/pull')
  async pull(@RouteParamPath('driveId') driveId: string) {
    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);
      const userConfig = await userConfigService.load();

      const publicKey = await userConfigService.getDeployKey();
      const privateKey = await userConfigService.getDeployPrivateKey();
      const passphrase = 'sekret';

      await gitScanner.pullBranch(userConfig.remote_branch || 'master', {
        publicKey, privateKey, passphrase
      });

      return {};
    } catch (err) {
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

  @RoutePost('/:driveId/push')
  async push(@RouteParamPath('driveId') driveId: string) {
    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);
      const userConfig = await userConfigService.load();

      const publicKey = await userConfigService.getDeployKey();
      const privateKey = await userConfigService.getDeployPrivateKey();
      const passphrase = 'sekret';

      await gitScanner.pushBranch(userConfig.remote_branch || 'master', {
        publicKey, privateKey, passphrase
      });

      return {};
    } catch (err) {
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }


}
