import {CommonFileData, ConflictData} from './LocalFile';
import {FileId} from './model';

export interface TreeItem extends CommonFileData {
  parentId: FileId;
  realFileName: string;
  path: string;
  version?: number;
  children?: TreeItem[];
  conflicting?: ConflictData[];
  redirectTo?: FileId;
  lastAuthor?: string;
}
