import {
  Controller, ErrorHandler,
  RouteErrorHandler,
  RouteParamPath,
  RouteResponse,
  RouteUse
} from './Controller';
import {GoogleFilesScanner} from '../../transform/GoogleFilesScanner';
import {MimeTypes} from '../../../model/GoogleFile';
import {AuthConfig} from '../../../model/AccountJson';
import {FileContentService} from '../../../utils/FileContentService';
import {FileId} from '../../../model/model';
import express from 'express';

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

export interface TreeItem {
  id: FileId;
  name: string;
  path: string;
  mimeType: string;
  children?: TreeItem[];
}

type CallBack = (treeItem: TreeItem) => boolean;

export function findInTree(callBack: CallBack, files: TreeItem[], folderId: string) {
  for (const child of files) {
    if (callBack(child)) {
      return {child, folderId};
    }
  }

  for (const file of files) {
    if (file.mimeType !== MimeTypes.FOLDER_MIME) {
      continue;
    }

    if (file.children) {
      const result = findInTree(callBack, file.children, file.id);
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

export async function outputDirectory(res: express.Response, treeItem: TreeItem, folderFileSystem: FileContentService, googleFolderFileSystem: FileContentService) {
  const scanner = new GoogleFilesScanner();
  const googleFiles = await scanner.scan(googleFolderFileSystem);

  const localFiles = [].concat(treeItem.children);
  localFiles.sort((file1, file2) => {
    if ((MimeTypes.FOLDER_MIME === file1.mimeType) && !(MimeTypes.FOLDER_MIME === file2.mimeType)) {
      return -1;
    }
    if (!(MimeTypes.FOLDER_MIME === file1.mimeType) && (MimeTypes.FOLDER_MIME === file2.mimeType)) {
      return 1;
    }
    return file1.name.toLocaleLowerCase().localeCompare(file2.name.toLocaleLowerCase());
  });

  const retVal = [];
  for (const local of localFiles) {
    if (local.id) {
      retVal.push({
        google: googleFiles.find(gf => gf.id === local.id),
        local
      });
    } else {
      retVal.push({
        local
      });
    }
  }

  res.setHeader('content-type', MimeTypes.FOLDER_MIME);
  res.send(JSON.stringify(retVal));
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
    const transformedTree = await transformedFileSystem.readJson('.tree.json');

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const driveTree = await googleFileSystem.readJson('.tree.json');

    const { child: local, folderId: parentFolderId } = filePath === '/'
      ? { child: { id: driveId, children: transformedTree }, folderId: driveId }
      : findInTree(treeItem => treeItem.path === filePath, transformedTree, driveId);

    if (!local) {
      this.res.status(404).send('No local');
      return;
    }

    this.res.setHeader('wgd-google-parent-id', parentFolderId || '');
    this.res.setHeader('wgd-google-id', local.id || '');
    this.res.setHeader('wgd-path', local.path || '');
    this.res.setHeader('wgd-file-name', local.fileName || '');

    if (!await transformedFileSystem.exists(filePath)) {
      this.res.status(404).send('Not exist in transformedFileSystem');
      return;
    }
    if (await transformedFileSystem.isDirectory(filePath)) {
      let googleFolderFileSystem = googleFileSystem;
      const [file, drivePath] = generateTreePath(local.id, driveTree, 'id');
      if (file && drivePath) {
        googleFolderFileSystem = await googleFolderFileSystem.getSubFileService(drivePath);
      }

      await outputDirectory(this.res, local, await transformedFileSystem.getSubFileService(filePath), googleFolderFileSystem);

      return;
    } else {
      if (local.mimeType) {
        this.res.setHeader('Content-type', local.mimeType);
      }

      const buffer = await transformedFileSystem.readBuffer(filePath);
      this.res.send(buffer);
      return;
    }
  }

}
