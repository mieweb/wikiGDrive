import {DateISO, FileId} from './model';

export interface CommonFileData {
  title: string;
  id: FileId;
  modifiedTime?: DateISO;
  fileName: string;
  mimeType?: string;
  version?: number;
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
}

export interface DrawingFile extends CommonFileData {
  type: 'drawing';
}

export interface BinaryFile extends CommonFileData { // TODO md5?
  type: 'binary';
}

export interface Directory extends CommonFileData {
  type: 'directory';
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
