import {CommonFileData} from './LocalFile';
import {FileId} from './model';

export interface TreeItem extends CommonFileData {
  parentId: FileId;
  realFileName: string;
  path: string;
  children?: TreeItem[];
}
