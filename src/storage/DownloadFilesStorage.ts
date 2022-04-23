'use strict';

type DateISO = string;
type FileId = string;

export interface ImageMeta {
  zipPath?: string;
  width: number;
  height: number;
  hash: string;
}

export interface DownloadFileImage {
  docUrl: string;
  pngUrl?: string;
  zipImage?: ImageMeta;
  fileId?: string;
}

export interface DownloadFile {
  id: FileId;
  name: string;
  mimeType: string;
  modifiedTime?: DateISO;
  version: number;
  md5Checksum?: string;
  image?: ImageMeta;
  images?: DownloadFileImage[];
}
