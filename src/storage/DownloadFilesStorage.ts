'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {FileService} from '../utils/FileService';

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
  private fileService: FileService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: FileMap;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'download.json');
  }

  async init() {
    await this.loadData();
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

  async loadData() {
    try {
      const content = await this.fileService.readFile(this.filePath);
      this.fileMap = JSON.parse(content) || {};
    } catch (error) {
      this.fileMap = {};
    }
  }

  async flushData() {
    if (!this.save_needed) {
      return ;
    }

    const content = JSON.stringify(this.fileMap, null, 2);
    fs.writeFileSync(this.filePath, content);
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
