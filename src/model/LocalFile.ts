import {DateISO, FileId} from './model';

export interface CommonFileData {
  title: string;
  id: FileId;
  modifiedTime?: DateISO;
  fileName: string;
  mimeType?: string;
}

export interface ConflictData {
  realFileName: string;
  id: FileId;
  title: string;
}

export interface ConflictFile extends CommonFileData {
  type: 'conflict';
  conflicting: ConflictData[];
}

export interface RedirFile extends CommonFileData {
  type: 'redir';
  redirectTo: FileId;
}

export interface MdFile extends CommonFileData {
  lastAuthor: string;
  type: 'md';
  version?: number;
}

export interface DrawingFile extends CommonFileData {
  type: 'drawing';
  version?: number;
}

export interface BinaryFile extends CommonFileData { // TODO md5?
  type: 'binary';
  version?: number;
}

export interface Directory extends CommonFileData {
  type: 'directory';
  version?: number;
}

export type LocalFile = MdFile | RedirFile | ConflictFile | Directory | DrawingFile | BinaryFile;

export function isRedirect(file: LocalFile) {
  return file.type === 'redir';
}

export function isConflict(file: LocalFile) {
  return file.type === 'conflict';
}

export interface LocalFileMap {
  [id: string]: LocalFile;
}
