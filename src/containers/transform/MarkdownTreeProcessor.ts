import {FileContentService} from '../../utils/FileContentService';
import {TreeItem} from '../../model/TreeItem';
import {DirectoryScanner, RESERVED_NAMES} from './DirectoryScanner';
import {MimeTypes} from '../../model/GoogleFile';
import {FileId} from '../../model/model';

type CallBack<K> = (treeItem: K) => boolean;

export type TreeItemTuple = [ TreeItem?, string? ];

export class MarkdownTreeProcessor {
  private driveTree: TreeItem[] = [];

  constructor(private driveFileSystem: FileContentService) {
  }

  async load() {
    this.driveTree = await this.driveFileSystem.readJson('.tree.json') || [];
  }

  async save() {
    this.driveTree[0]['wikigdrive'] = process.env.GIT_SHA;
    await this.driveFileSystem.writeJson('.tree.json', this.driveTree);
  }

  async regenerateTree(rootFolderId: FileId): Promise<void> {
    this.driveTree = await this.internalRegenerateTree(this.driveFileSystem, rootFolderId);
  }

  private async internalRegenerateTree(contentFileService: FileContentService, parentId?: string): Promise<Array<TreeItem>> {
    const scanner = new DirectoryScanner();
    const files = await scanner.scan(contentFileService);
    const retVal = [];
    for (const realFileName in files) {
      if (RESERVED_NAMES.includes(realFileName)) {
        continue;
      }
      if (realFileName.endsWith('.debug.xml')) {
        continue;
      }

      const file = files[realFileName];
      if (file.mimeType === MimeTypes.FOLDER_MIME) {
        const subFilesService = await contentFileService.getSubFileService(realFileName);
        const item: TreeItem = {
          id: file.id,
          title: file.title,
          path: contentFileService.getVirtualPath() + realFileName,
          realFileName: realFileName,
          fileName: file.fileName,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          version: file.version,
          conflicting: file.type === 'conflict' ? file.conflicting : undefined,
          redirectTo: file.type === 'redir' ? file.redirectTo : undefined,
          parentId,
          children: await this.internalRegenerateTree(subFilesService, file.id)
        };
        retVal.push(item);
      } else {
        const item: TreeItem = {
          id: file.id,
          title: file.title,
          path: contentFileService.getVirtualPath() + realFileName,
          fileName: file.fileName,
          realFileName: realFileName,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          version: file.version,
          conflicting: file.type === 'conflict' ? file.conflicting : undefined,
          redirectTo: file.type === 'redir' ? file.redirectTo : undefined,
          parentId
        };
        retVal.push(item);
      }
    }
    return retVal;
  }

  async findById(fileId: FileId): Promise<TreeItemTuple> {
    return await this.findInTree(item => item.id === fileId, this.driveTree);
  }

  async findByPath(path: string) {
    return await this.findInTree(item => item.path === path, this.driveTree);
  }

  private async findInTree(callBack: CallBack<TreeItem>, children: Array<TreeItem>, curPath = ''): Promise<TreeItemTuple> {
    for (const file of children) {
      const part = file['realFileName'];
      if (callBack(file)) {
        return [ file, curPath ? curPath + '/' + part : part ];
      }
    }

    for (const file of children) {
      if (file.mimeType !== MimeTypes.FOLDER_MIME) {
        continue;
      }

      if (file.children) {
        const part = file['realFileName'];
        const tuple = await this.findInTree(callBack, file.children, curPath ? curPath + '/' + part : part);
        if (tuple?.length > 0) {
          return tuple;
        }
      }
    }

    return [];
  }

  async walkTree(callBack: CallBack<TreeItem>) {
    await this.findInTree(callBack, this.driveTree);
  }

  async getRootItem(driveId: FileId): Promise<TreeItemTuple> {
    return [{
      path: '/',
      fileName: '/',
      realFileName: '/',
      title: '/',
      mimeType: MimeTypes.FOLDER_MIME,
      id: driveId,
      parentId: driveId,
      children: this.driveTree
    }, '/'];
  }

  isEmpty() {
    return this.driveTree.length === 0;
  }

  getTree() {
    return this.driveTree;
  }

  getTreeVersion() {
    if (this.driveTree.length < 1) {
      return null;
    }

    return this.driveTree[0]['wikigdrive'];
  }
}
