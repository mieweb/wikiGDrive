import {Logger} from 'winston';
import {
  Controller, ErrorHandler,
  RouteErrorHandler,
  RouteResponse,
  RouteUse, type ControllerCallContext
} from './Controller.ts';
import {MimeTypes} from '../../../model/GoogleFile.ts';
import {AuthConfig} from '../../../model/AccountJson.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {TreeItem} from '../../../model/TreeItem.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {DirectoryScanner, isTextFileName} from '../../transform/DirectoryScanner.ts';
import {GitChange, GitScanner} from '../../../git/GitScanner.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {clearCachedChanges} from '../../job/JobManagerContainer.ts';
import {getContentFileService} from '../../transform/utils.ts';
import {LocalLog} from '../../transform/LocalLog.ts';
import {ContainerEngine} from '../../../ContainerEngine.ts';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer.ts';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor.ts';
import {FileId} from '../../../model/model.ts';

export const extToMime = {
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'css': 'text/css',
  'txt': 'text/plain',
  'md': 'text/x-markdown',
  'htm': 'text/html',
  'html': 'text/html',
  'svg': 'image/svg+xml'
};

// deno-lint-ignore no-unused-vars
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function convertToPreviewUrl(preview_rewrite_rules: string, driveId: string) {
  return (file: { path: string }) => {
    for (const preview_rewrite_rule of preview_rewrite_rules.split('\n')) {
      const preview_rewrite_rule_parts = preview_rewrite_rule.split('!').filter(str => !!str);

      if (file.path.match(new RegExp(preview_rewrite_rule_parts[0]))) {
        const previewUrl = file.path.replace(new RegExp(preview_rewrite_rule_parts[0]), preview_rewrite_rule_parts[1]);
        return { ...file, previewUrl };
      }
    }
    return { ...file, previewUrl: file.path };
  };
}

export class ShareErrorHandler extends ErrorHandler {
  private authContainer;

  async catch(err) {
    if (err.message === 'Drive not shared with wikigdrive') {
      const authConfig: AuthConfig = this.authContainer['authConfig'];
      this.res.status(404).json({ not_registered: true, share_email: authConfig.share_email });
      return;
    }
    throw err;
  }
}

export const CACHE_PATH = '.private/cached_git_status.json';

const workingJobs = {};

export async function getCachedChanges(logger: Logger, transformedFileSystem: FileContentService, contentFileService: FileContentService, googleFileSystem: FileContentService): Promise<GitChange[]> {
  let mtime = 0;
  try {
    const mtimeGit = await transformedFileSystem.getMtime('.git/refs/head/master');
    if (mtime < mtimeGit) mtime = mtimeGit;
    // deno-lint-ignore no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (ignore) { /* empty */}

  try {
    const mtimeContent = await contentFileService.getMtime('.tree.json');
    if (mtime < mtimeContent) mtime = mtimeContent;
    // deno-lint-ignore no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (ignore) { /* empty */}

  if (await googleFileSystem.exists(CACHE_PATH)) {
    const cached = await googleFileSystem.readJson(CACHE_PATH);
    if (cached?.mtime === mtime) {
      return cached.changes;
    }
  }

  if (workingJobs[contentFileService.getRealPath()]) {
    return workingJobs[contentFileService.getRealPath()];
  }

  // eslint-disable-next-line no-async-promise-executor
  workingJobs[contentFileService.getRealPath()] = new Promise(async (resolve, reject) => {
    try {
      const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();

      const changes = await gitScanner.changes();
      await googleFileSystem.writeJson(CACHE_PATH, {
        mtime: mtime,
        changes
      });

      delete workingJobs[contentFileService.getRealPath()];
      resolve(changes);
    } catch (err) {
      delete workingJobs[contentFileService.getRealPath()];
      reject(err);
    }
  });

  return workingJobs[contentFileService.getRealPath()];
}

async function addGitData(treeItems: TreeItem[], changes: GitChange[], contentFilePath: string) {
  if (contentFilePath.startsWith('/')) {
    contentFilePath = contentFilePath.substring(1);
  }

  for (const treeItem of treeItems) {
    const change = changes.find(change => change.path === (contentFilePath + treeItem.path).replace(/^\//, ''));
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
  }
}

export function outputDirectory(treeItem: TreeItem): TreeItem[] {
  const treeItems: TreeItem[] = [].concat(treeItem.children || []);

  treeItems.sort((file1: TreeItem, file2: TreeItem) => {
    if ((MimeTypes.FOLDER_MIME === file1.mimeType) && !(MimeTypes.FOLDER_MIME === file2.mimeType)) {
      return -1;
    }
    if (!(MimeTypes.FOLDER_MIME === file1.mimeType) && (MimeTypes.FOLDER_MIME === file2.mimeType)) {
      return 1;
    }
    if (!file1.fileName || !file2.fileName) {
      return 0;
    }
    return file1.fileName.toLocaleLowerCase().localeCompare(file2.fileName.toLocaleLowerCase());
  });

  return treeItems;
}

function inDir(dirPath: string, filePath: string) {
  if (dirPath === filePath) {
    return true;
  }
  return filePath.startsWith(dirPath + '/');
}

export default class FolderController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private engine: ContainerEngine) {
    super(subPath);
  }

  async removeFolder(driveId: string, contentFileService: FileContentService, filePath: string) {
    if (filePath.length < 2) {
      return { removed: false };
    }

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    await transformedFileSystem.remove(filePath);

    // Remove redirs
    const localLog = new LocalLog(contentFileService);
    await localLog.load();

    const googleFileSystem = await this.filesService.getSubFileService(
      driveId,
      '',
    );

    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const contentDir =
      (userConfigService.config.transform_subdir || '').startsWith('/')
        ? (userConfigService.config.transform_subdir || '')
        : '';

    if (await localLog.remove(filePath.substring(contentDir.length))) {
      await localLog.save();
    }

    await clearCachedChanges(googleFileSystem);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.regenerateTree(driveId);
    await markdownTreeProcessor.save();

    return { removed: true, filePath };
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(ctx: ControllerCallContext) {
    const method: string = await ctx.routeParamMethod();
    const driveId: string = await ctx.routeParamPath('driveId');
    const body: string = await ctx.routeParamBody();

    const filePath = ctx.req.originalUrl.replace('/api/file/' + driveId, '') || '/';

    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    if (!folderRegistryContainer.hasFolder(driveId)) {
      ctx.res.status(404).send(JSON.stringify({ message: 'Folder not registered' }));
      return;
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    if (method === 'delete') {
      const result = await this.removeFolder(driveId, contentFileService, filePath);
      ctx.res.status(200).send(JSON.stringify(result));

      this.engine.emit(driveId, 'toasts:added', {
        title: 'File deleted: ' + filePath,
        type: 'tree:changed'
      });
      return;
    }

    if (method === 'put') {
      if (!await transformedFileSystem.exists(filePath)) {
        ctx.res.status(404).send('Not exist in transformedFileSystem');
        return;
      }
      await transformedFileSystem.writeFile(filePath, body);
      await clearCachedChanges(googleFileSystem);
      this.engine.emit(driveId, 'toasts:added', {
        title: 'File modified: ' + filePath,
        type: 'tree:changed'
      });
    }

    const googleTreeProcessor = new GoogleTreeProcessor(googleFileSystem);
    await googleTreeProcessor.load();

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();

    const treeVersion = markdownTreeProcessor.getTreeVersion();

    ctx.res.setHeader('wgd-drive-empty', googleTreeProcessor.getTree().length === 0 ? 'true' : 'false');
    ctx.res.setHeader('wgd-tree-empty', markdownTreeProcessor.getTree().length === 0 ? 'true' : 'false');
    ctx.res.setHeader('wgd-tree-version', treeVersion);
    ctx.res.setHeader('wgd-content-dir', userConfigService.config.transform_subdir || '');

    if (!await transformedFileSystem.exists(filePath)) {
      ctx.res.status(404).send({ message: 'Not exist in transformedFileSystem' });
      return;
    }

    if ((userConfigService.config.transform_subdir || '').startsWith('/') && inDir(userConfigService.config.transform_subdir, filePath)) {
      const prefixed_subdir = userConfigService.config.transform_subdir;
      const contentFilePath = filePath.replace(prefixed_subdir, '') || '/';

      const [treeItem] = contentFilePath === '/'
        ? await markdownTreeProcessor.getRootItem(driveId)
        : await markdownTreeProcessor.findByPath(contentFilePath);

      if (treeItem) {
        const { previewUrl } = convertToPreviewUrl(userConfigService.config.preview_rewrite_rule || '', driveId)({ path: treeItem.path || '' });

        ctx.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
        ctx.res.setHeader('wgd-google-id', treeItem.id || '');
        ctx.res.setHeader('wgd-google-version', treeItem.version || '');
        ctx.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
        ctx.res.setHeader('wgd-path', treeItem.path || '');
        ctx.res.setHeader('wgd-file-name', treeItem.fileName || '');
        ctx.res.setHeader('wgd-mime-type', treeItem.mimeType || '');
        ctx.res.setHeader('wgd-preview-url', previewUrl);
        ctx.res.setHeader('wgd-last-author', treeItem.lastAuthor || '');

        if (await transformedFileSystem.isDirectory(filePath)) {
          const changes = await getCachedChanges(ctx.logger, transformedFileSystem, contentFileService, googleFileSystem);
          const subDir = await transformedFileSystem.getSubFileService(filePath);
          const map1: Map<string, TreeItem> = new Map(
            (await this.generateChildren(subDir, driveId, prefixed_subdir, filePath))
              .map(element => [element.realFileName, element])
          );
          const map2: Map<string, TreeItem> = new Map(
            treeItem.children.map(convertToPreviewUrl(userConfigService.config.preview_rewrite_rule || '', driveId))
              .map(element => [element.realFileName, element])
          );
          treeItem.children = Object.values({ ...Object.fromEntries(map1), ...Object.fromEntries(map2) });
          await addGitData(treeItem.children, changes, prefixed_subdir);

          const treeItems = outputDirectory(treeItem);
          ctx.res.setHeader('content-type', MimeTypes.FOLDER_MIME);
          ctx.res.send(JSON.stringify(treeItems));
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

    if (!await transformedFileSystem.exists(filePath)) {
      ctx.res.status(404).send({ message: 'Not exist in transformedFileSystem' });
      return;
    }

    if (await transformedFileSystem.isDirectory(filePath)) {
      const subDir = await transformedFileSystem.getSubFileService(filePath);
      const treeItem: TreeItem = {
        fileName: filePath,
        id: '',
        parentId: '',
        path: filePath,
        realFileName: '',
        title: '',
        mimeType: MimeTypes.FOLDER_MIME,
        children: await this.generateChildren(subDir, driveId, userConfigService.config.transform_subdir || '/', filePath)
      };

      const changes = await getCachedChanges(ctx.logger, transformedFileSystem, contentFileService, googleFileSystem);
      await addGitData(treeItem.children, changes, '');
      treeItem.children = treeItem.children.map(convertToPreviewUrl(userConfigService.config.preview_rewrite_rule, driveId));

      const treeItems = outputDirectory(treeItem);
      ctx.res.setHeader('content-type', MimeTypes.FOLDER_MIME);
      ctx.res.send(JSON.stringify(treeItems));
      return;
    } else {
      const ext = await transformedFileSystem.guessExtension(filePath);

      const mimeType = extToMime[ext] || (isTextFileName(filePath) ? 'text/plain' : undefined);
      if (mimeType) {
        ctx.res.setHeader('Content-type', mimeType);
      }

      if ('md' === ext) {
        const { previewUrl } = convertToPreviewUrl(userConfigService.config.preview_rewrite_rule, driveId)(filePath);
        ctx.res.setHeader('wgd-path', filePath || '');
        ctx.res.setHeader('wgd-mime-type', mimeType);
        ctx.res.setHeader('wgd-preview-url', previewUrl);
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      ctx.res.send(buffer);
      return;
    }
  }

  async generateChildren(transformedFileSystem: FileContentService, driveId: FileId, subdir: string, dirPath: string) {
    const scanner = new DirectoryScanner();
    const files = await scanner.scan(transformedFileSystem);

    return Object.values(files)
      .map(file => {
        return {
          fileName: file.fileName,
          id: subdir === dirPath + file.fileName ? driveId : 'UNKNOWN',
          parentId: 'UNKNOWN',
          path: dirPath + file.fileName,
          realFileName: file.fileName,
          title: file.title,
          mimeType: file.mimeType,
          conflicting: file.type === 'conflict' ? file.conflicting : undefined,
          redirectTo: file.type === 'redir' ? file.redirectTo : undefined
        };
      });
  }

}
