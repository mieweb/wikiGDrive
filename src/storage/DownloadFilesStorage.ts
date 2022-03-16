'use strict';

import path from 'path';

import {FileContentService} from '../utils/FileContentService';

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

export interface FileMap {
  [id: string]: DownloadFile;
}

export class DownloadFilesStorage {
  private fileService: FileContentService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: FileMap;

  constructor(private config_dir: string) {
    this.fileService = new FileContentService();
    this.filePath = path.join(config_dir, 'download.json');
  }

  async init() {
    this.fileMap = await this.fileService.readJson(this.filePath);

    setInterval(() => {
      this.flushData();
    }, 500);
  }

  getFileMap() {
    return this.fileMap;
  }

  findFile(checker): DownloadFile {
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker): DownloadFile[] {
    const retVal = [];
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
  }

  containsFile(fileId) {
    return !!this.fileMap[fileId];
  }

  async flushData() {
    if (!this.save_needed) {
      return ;
    }

    await this.fileService.writeJson(this.filePath, this.fileMap);
    this.save_needed = false;
  }

  async updateFile(file: DownloadFile) {
    this.fileMap[file.id] = Object.assign({}, file);
    this.save_needed = true;
  }

  async removeFile(fileId) {
    if (!this.fileMap[fileId]) {
      return;
    }
    delete this.fileMap[fileId];
    this.save_needed = true;
  }
}
