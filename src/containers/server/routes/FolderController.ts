import {
  Controller, ErrorHandler,
  RouteErrorHandler,
  RouteParamPath,
  RouteResponse,
  RouteUse
} from './Controller';
import {MimeTypes} from '../../../model/GoogleFile';
import {AuthConfig} from '../../../model/AccountJson';
import {FileContentService} from '../../../utils/FileContentService';
import {FileId} from '../../../model/model';
import express from 'express';
import {TreeItem} from '../../../model/TreeItem';
import {UserConfigService} from '../../google_folder/UserConfigService';
import {DirectoryScanner} from '../../transform/DirectoryScanner';
import {GitChange, GitScanner} from '../../../git/GitScanner';

const extToMime = {
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'css': 'text/css',
  'txt': 'text/plain',
  'md': 'text/plain',
  'htm': 'text/html',
  'html': 'text/html'
};

export function generateTreePath(fileId: FileId, files: TreeItem[], fieldName: string, curPath = '') {
  if (!Array.isArray(files)) {
    return [];
  }
  for (const file of files) {
    const part = file[fieldName];

    if (file.id === fileId) {
      return [ file, curPath ? curPath + '/' + part : part ];
    }
  }

  for (const file of files) {
    if (file.mimeType !== MimeTypes.FOLDER_MIME) {
      continue;
    }

    const part = file[fieldName];

    if (file.children) {
      const tuple = generateTreePath(fileId, file.children, fieldName, curPath ? curPath + '/' + part : part);
      if (tuple?.length > 0) {
        return tuple;
      }
    }
  }

  return [];
}

export interface BaseTreeItem {
  mimeType: string;
  children?: Array<BaseTreeItem>;
}

type CallBack<K> = (treeItem: K) => boolean;

export function findInTree(callBack: CallBack<BaseTreeItem>, files: Array<BaseTreeItem>) {
  for (const treeItem of files) {
    if (callBack(treeItem)) {
      return treeItem;
    }
  }

  for (const file of files) {
    if (file.mimeType !== MimeTypes.FOLDER_MIME) {
      continue;
    }

    if (file.children) {
      const result = findInTree(callBack, file.children);
      if (result) {
        return result;
      }
    }
  }

  return null;
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

async function getCachedChanges(transformedFileSystem: FileContentService, contentFileService: FileContentService, googleFileSystem: FileContentService): Promise<GitChange[]> {
  const CACHE_PATH = '.private/cached_git_status.json';

  let mtime = 0;
  try {
    mtime += await transformedFileSystem.getMtime('.git');
    // eslint-disable-next-line no-empty
  } catch (ignore) {}

  try {
    mtime += await contentFileService.getMtime('');
    // eslint-disable-next-line no-empty
  } catch (ignore) {}

  if (await googleFileSystem.exists(CACHE_PATH)) {
    const cached = await googleFileSystem.readJson(CACHE_PATH);
    if (cached?.mtime === mtime) {
      return cached.changes;
    }
  }

  const gitScanner = new GitScanner(transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
  await gitScanner.initialize();

  const changes = await gitScanner.changes();
  await googleFileSystem.writeJson(CACHE_PATH, {
    mtime: mtime,
    changes
  });
  return changes;
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
      if (change.state.isModified || change.state.isRenamed) {
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

  constructor(subPath: string, private readonly filesService: FileContentService, private readonly authContainer) {
    super(subPath);
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(@RouteParamPath('driveId') driveId: string) {
    const filePath = this.req.originalUrl.replace('/api/file/' + driveId, '') || '/';

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = userConfigService.config.transform_subdir ? await transformedFileSystem.getSubFileService(userConfigService.config.transform_subdir) : transformedFileSystem;
    const transformedTree = await contentFileService.readJson('.tree.json') || [];

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }

    if (!userConfigService.config.transform_subdir || inDir('/' + userConfigService.config.transform_subdir, filePath)) {
      const contentFilePath = !userConfigService.config.transform_subdir ?
        filePath :
        filePath.replace('/' + userConfigService.config.transform_subdir, '') || '/';

      const treeItem = contentFilePath === '/'
        ? { id: driveId, children: transformedTree, parentId: driveId, path: '/', mimeType: MimeTypes.FOLDER_MIME }
        : findInTree(treeItem => treeItem['path'] === contentFilePath, transformedTree);

      if (!treeItem) {
        this.res.status(404).send('No local');
        return;
      }

      this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
      this.res.setHeader('wgd-google-id', treeItem.id || '');
      this.res.setHeader('wgd-google-version', treeItem.version || '');
      this.res.setHeader('wgd-google-modified-time', treeItem.modifiedTime || '');
      this.res.setHeader('wgd-path', treeItem.path || '');
      this.res.setHeader('wgd-file-name', treeItem.fileName || '');
      this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');

      if (await transformedFileSystem.isDirectory(filePath)) {
        const changes = await getCachedChanges(transformedFileSystem, contentFileService, googleFileSystem);
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
    } else {
      if (await transformedFileSystem.isDirectory(filePath)) {
        const scanner = new DirectoryScanner();
        const files = await scanner.scan(transformedFileSystem);

        const treeItem: TreeItem = {
          fileName: filePath,
          id: '',
          parentId: '',
          path: filePath,
          realFileName: '',
          title: '',
          mimeType: MimeTypes.FOLDER_MIME,
          children: Object.values(files)
            .map(file => {
              return {
                fileName: file.fileName,
                id: 'UNKNOWN',
                parentId: 'UNKNOWN',
                path: filePath + file.fileName,
                realFileName: file.fileName,
                title: file.title,
                mimeType: file.mimeType
              };
           })
        };

        const changes = await getCachedChanges(transformedFileSystem, contentFileService, googleFileSystem);
        await addGitData(treeItem.children, changes, '');
        await outputDirectory(this.res, treeItem);
        return;
      } else {
        const ext = await transformedFileSystem.guessExtension(filePath);
        const mimeType = extToMime[ext];
        if (mimeType) {
          this.res.setHeader('Content-type', mimeType);
        }

        const buffer = await transformedFileSystem.readBuffer(filePath);
        this.res.send(buffer);
        return;
      }
    }
  }

}
