import {CommonFileData, ConflictData} from './LocalFile.ts';
import {FileId} from './model.ts';

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
