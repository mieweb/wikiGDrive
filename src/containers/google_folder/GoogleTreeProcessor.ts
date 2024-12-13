import {FileContentService} from '../../utils/FileContentService.ts';
import {MimeTypes} from '../../model/GoogleFile.ts';
import {GoogleTreeItem} from './GoogleFolderContainer.ts';
import {GoogleFilesScanner} from '../transform/GoogleFilesScanner.ts';
import {FileId} from '../../model/model.ts';

type CallBack<K> = (treeItem: K) => boolean;

export type TreeItemTuple = [ GoogleTreeItem?, string? ];

export class GoogleTreeProcessor {
  private driveTree: GoogleTreeItem[] = [];

  constructor(private filesService: FileContentService) {
  }

  async load() {
    this.driveTree = await this.filesService.readJson('.tree.json') || [];
  }

  async save() {
    await this.filesService.writeJson('.tree.json', this.driveTree);
  }

  async regenerateTree(): Promise<void> {
    this.driveTree = await this.internalRegenerateTree(this.filesService);
  }

  private async internalRegenerateTree(filesService: FileContentService, parentId?: string): Promise<Array<GoogleTreeItem>> {
    const scanner = new GoogleFilesScanner();
    const files = await scanner.scan(filesService);
    const retVal = [];
    for (const file of files) {
      if (file.mimeType === MimeTypes.FOLDER_MIME) {
        const subFileService = await filesService.getSubFileService(file.id);
        const item: GoogleTreeItem = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          version: file.version,
          parentId,
          children: await this.internalRegenerateTree(subFileService, file.id)
        };
        retVal.push(item);
      } else {
        const item: GoogleTreeItem = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          version: file.version,
          parentId
        };
        retVal.push(item);
      }
    }
    return retVal;
  }

  getTree() {
    return this.driveTree;
  }

  async findById(fileId: FileId): Promise<TreeItemTuple> {
    return await this.findInTree(item => item.id === fileId, this.driveTree);
  }

  private async findInTree(callBack: CallBack<GoogleTreeItem>, children: Array<GoogleTreeItem>, curPath = ''): Promise<TreeItemTuple> {
    for (const file of children) {
      const part = file['id'];
      if (callBack(file)) {
        return [ file, curPath ? curPath + '/' + part : part ];
      }
    }

    for (const file of children) {
      if (file.mimeType !== MimeTypes.FOLDER_MIME) {
        continue;
      }

      if (file.children) {
        const part = file['id'];
        const tuple = await this.findInTree(callBack, file.children, curPath ? curPath + '/' + part : part);
        if (tuple?.length > 0) {
          return tuple;
        }
      }
    }

    return [];
  }

}
