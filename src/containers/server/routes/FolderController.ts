import {
  Controller, ErrorHandler,
  RouteErrorHandler,
  RouteParamPath, RouteParamMethod,
  RouteResponse,
  RouteUse, RouteParamBody
} from './Controller';
import {MimeTypes} from '../../../model/GoogleFile';
import {AuthConfig} from '../../../model/AccountJson';
import {FileContentService} from '../../../utils/FileContentService';
import express from 'express';
import {TreeItem} from '../../../model/TreeItem';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {DirectoryScanner, isTextFileName} from '../../transform/DirectoryScanner';
import {GitChange, GitScanner} from '../../../git/GitScanner';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor';
import {Logger} from 'winston';
import {clearCachedChanges} from '../../job/JobManagerContainer';
import {getContentFileService} from '../../transform/utils';
import {LocalLog} from '../../transform/LocalLog';
import {ContainerEngine} from '../../../ContainerEngine';
import {FolderRegistryContainer} from '../../folder_registry/FolderRegistryContainer';
import {GoogleTreeProcessor} from '../../google_folder/GoogleTreeProcessor';

export const extToMime = {
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'css': 'text/css',
  'txt': 'text/plain',
  'md': 'text/plain',
  'htm': 'text/html',
  'html': 'text/html',
  'svg': 'image/svg+xml'
};

export function addPreviewUrl(hugo_theme, driveId) {
  return (file) => {
    const previewMdUrl = '/' + driveId + (hugo_theme?.id ? `/${hugo_theme?.id}` : '/_manual') + file.path;

    const previewUrl = '/preview' +
      previewMdUrl
        .replace(/.md$/, '')
        .replace(/_index$/, '');

    return { ...file, previewUrl };
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
    // eslint-disable-next-line no-empty
  } catch (ignore) {}

  try {
    const mtimeContent = await contentFileService.getMtime('.tree.json');
    if (mtime < mtimeContent) mtime = mtimeContent;
    // eslint-disable-next-line no-empty
  } catch (ignore) {}

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

export async function outputDirectory(res: express.Response, treeItem: TreeItem) {
  const treeItems = [].concat(treeItem.children || []);

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

  res.setHeader('content-type', MimeTypes.FOLDER_MIME);
  res.send(JSON.stringify(treeItems));
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
    if (await localLog.remove(filePath)) {
      await localLog.save();
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    await clearCachedChanges(googleFileSystem);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.regenerateTree(driveId);
    await markdownTreeProcessor.save();

    return { removed: true, filePath };
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(@RouteParamMethod() method: string, @RouteParamPath('driveId') driveId: string,
                  @RouteParamBody() body: string) {
    const filePath = this.req.originalUrl.replace('/api/file/' + driveId, '') || '/';

    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    if (!folderRegistryContainer.hasFolder(driveId)) {
      this.res.status(404).send(JSON.stringify({ message: 'Folder not registered' }));
      return;
    }

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    if (method === 'delete') {
      const result = await this.removeFolder(driveId, contentFileService, filePath);
      this.res.status(200).send(JSON.stringify(result));

      this.engine.emit(driveId, 'toasts:added', {
        title: 'File deleted: ' + filePath,
        type: 'tree:changed'
      });
      return;
    }

    if (method === 'put') {
      if (!await transformedFileSystem.exists(filePath)) {
        this.res.status(404).send('Not exist in transformedFileSystem');
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

    this.res.setHeader('wgd-drive-empty', googleTreeProcessor.getTree().length === 0 ? 'true' : 'false');
    this.res.setHeader('wgd-tree-empty', markdownTreeProcessor.getTree().length === 0 ? 'true' : 'false');
    this.res.setHeader('wgd-tree-version', treeVersion);
    const contentDir = userConfigService.config.transform_subdir ? '/' + userConfigService.config.transform_subdir : '/';
    this.res.setHeader('wgd-content-dir', contentDir);

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send({ message: 'Not exist in transformedFileSystem' });
      return;
    }

    if (!userConfigService.config.transform_subdir || inDir('/' + userConfigService.config.transform_subdir, filePath)) {
      const contentFilePath = !userConfigService.config.transform_subdir ?
        filePath :
        filePath.replace('/' + userConfigService.config.transform_subdir, '') || '/';

      const [treeItem] = contentFilePath === '/'
        ? await markdownTreeProcessor.getRootItem(driveId)
        : await markdownTreeProcessor.findByPath(contentFilePath);

      if (treeItem) {
        const previewMdUrl = treeItem.path
          ? '/' + driveId + (userConfigService.config.hugo_theme?.id ? `/${userConfigService.config.hugo_theme?.id}` : '/_manual') + treeItem.path
          : '';

        const previewUrl = '/preview' +
          previewMdUrl
            .replace(/.md$/, '')
            .replace(/_index$/, '');

        this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
        this.res.setHeader('wgd-google-id', treeItem.id || '');
        this.res.setHeader('wgd-google-version', treeItem.version || '');
        this.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
        this.res.setHeader('wgd-path', treeItem.path || '');
        this.res.setHeader('wgd-file-name', treeItem.fileName || '');
        this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');
        this.res.setHeader('wgd-preview-url', previewUrl);

        if (await transformedFileSystem.isDirectory(filePath)) {
          const changes = await getCachedChanges(this.logger, transformedFileSystem, contentFileService, googleFileSystem);
          treeItem.children = [
            ...await this.generateChildren(transformedFileSystem, driveId, '/' + userConfigService.config.transform_subdir, filePath),
            ...treeItem.children.map(addPreviewUrl(userConfigService.config.hugo_theme, driveId))
          ];
          await addGitData(treeItem.children, changes, userConfigService.config.transform_subdir ? '/' + userConfigService.config.transform_subdir + '' : '');
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

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send({ message: 'Not exist in transformedFileSystem' });
      return;
    }

    if (await transformedFileSystem.isDirectory(filePath)) {
      const treeItem: TreeItem = {
        fileName: filePath,
        id: '',
        parentId: '',
        path: filePath,
        realFileName: '',
        title: '',
        mimeType: MimeTypes.FOLDER_MIME,
        children: await this.generateChildren(transformedFileSystem, driveId, '/' + userConfigService.config.transform_subdir, filePath)
      };

      const changes = await getCachedChanges(this.logger, transformedFileSystem, contentFileService, googleFileSystem);
      await addGitData(treeItem.children, changes, '');
      treeItem.children = treeItem.children.map(addPreviewUrl(userConfigService.config.hugo_theme, driveId));
      await outputDirectory(this.res, treeItem);
      return;
    } else {
      const ext = await transformedFileSystem.guessExtension(filePath);
      const mimeType = extToMime[ext];
      if (mimeType) {
        this.res.setHeader('Content-type', mimeType);
      } else {
        if (isTextFileName(filePath)) {
          this.res.setHeader('Content-type', 'text/plain');
        }
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      this.res.send(buffer);
      return;
    }
  }

  async generateChildren(transformedFileSystem, driveId, transform_subdir, dirPath) {
    const scanner = new DirectoryScanner();
    const files = await scanner.scan(transformedFileSystem);

    return Object.values(files)
      .map(file => {
        return {
          fileName: file.fileName,
          id: transform_subdir === dirPath + file.fileName ? driveId : 'UNKNOWN',
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
