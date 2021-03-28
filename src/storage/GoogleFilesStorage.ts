'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {FileService} from '../utils/FileService';

type DateISO = string;
type FileId = string;

export interface GoogleFile {
  id: FileId;
  parentId?: FileId;
  name: string;
  size?: number;
  trashed?: boolean;
  mimeType: string;
  modifiedTime?: DateISO;
  lastAuthor?: string;
}

export interface FileMap {
  [id: string]: GoogleFile;
}

export const MimeTypes = {
  FOLDER_MIME: 'application/vnd.google-apps.folder',
  DOCUMENT_MIME: 'application/vnd.google-apps.document',
  DRAWING_MIME: 'application/vnd.google-apps.drawing',
  SPREADSHEET_MIME: 'application/vnd.google-apps.spreadsheet',
  FORM_MIME: 'application/vnd.google-apps.form',
  PRESENTATION_MIME: 'application/vnd.google-apps.presentation',
  CONFLICT_MIME: 'conflict',
  REDIRECT_MIME: 'redirect'
};

export class GoogleFilesStorage {
  private fileService: FileService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: FileMap;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'google_files.json');
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

  async removeFile(fileId: string) {
    const file = this.fileMap[fileId];
    if (!file) {
      return;
    }

    if (file.mimeType === MimeTypes.FOLDER_MIME) {
      await this.removeDirChildren(file.id);
    }

    delete this.fileMap[fileId];
    this.save_needed = true;
  }

  async removeDirChildren(fileId) {
    for (const id in this.fileMap) {
      const file = this.fileMap[id];
      if (file.parentId === fileId) {
        await this.removeFile(file.id);
      }
    }
  }

  async mergeSingleFile(file: GoogleFile) {
    if (file.trashed) {
      await this.removeFile(file.id);
    } else {
      this.fileMap[file.id] = Object.assign({}, file, { trashed: undefined });
      this.save_needed = true;
    }
  }

  async mergeFullDir(files: GoogleFile[], parentId: string) {
    const dbFileIds = [];
    for (const k in this.fileMap) {
      const dbFile = this.fileMap[k];
      if (dbFile.parentId === parentId) {
        dbFileIds.push(k);
      }
    }

    const newFiles = files
      .filter(file => !file.trashed);

    const newFileIds = newFiles
      .map(file => file.id);

    for (const dbId in dbFileIds) {
      if (newFileIds.indexOf(dbId) === -1) {
        await this.removeFile(dbId);
      }
    }

    for (const newFile of newFiles) {
      this.fileMap[newFile.id] = Object.assign({}, newFile, { trashed: undefined });
    }
    this.save_needed = true;
  }

  findFile(checker) {
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker) {
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

  getMaxModifiedTime() {
    let maxModifiedTime = null;

    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (!maxModifiedTime) {
        maxModifiedTime = file.modifiedTime;
        continue;
      }

      if (maxModifiedTime < file.modifiedTime) {
        maxModifiedTime = file.modifiedTime;
      }
    }

    return maxModifiedTime;
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
}
