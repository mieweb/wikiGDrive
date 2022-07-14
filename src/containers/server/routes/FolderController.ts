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

  return {};
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

export async function outputDirectory(res: express.Response, treeItem: TreeItem) {
  const treeItems = [].concat(treeItem.children);
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

export default class FolderController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService, private readonly authContainer) {
    super(subPath);
  }

  @RouteUse('/:driveId')
  @RouteResponse('stream')
  @RouteErrorHandler(new ShareErrorHandler())
  async getFolder(@RouteParamPath('driveId') driveId: string) {
    const filePath = this.req.originalUrl.replace('/api/file/' + driveId, '') || '/';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const transformedTree = await transformedFileSystem.readJson('.tree.json') || [];

    const treeItem = filePath === '/'
      ? { id: driveId, children: transformedTree, parentId: driveId, path: '/', mimeType: MimeTypes.FOLDER_MIME }
      : findInTree(treeItem => treeItem['path'] === filePath, transformedTree);

    if (!treeItem) {
      this.res.status(404).send('No local');
      return;
    }

    this.res.setHeader('wgd-google-parent-id', treeItem.parentId || '');
    this.res.setHeader('wgd-google-id', treeItem.id || '');
    this.res.setHeader('wgd-path', treeItem.path || '');
    this.res.setHeader('wgd-file-name', treeItem.fileName || '');
    this.res.setHeader('wgd-mime-type', treeItem.mimeType || '');

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }
    if (await transformedFileSystem.isDirectory(filePath)) {
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
