'use strict';

import path from 'path';

import {FileContentService} from '../utils/FileContentService';
import {GoogleFile, MimeTypes} from '../model/GoogleFile';

interface FileMap {
  [id: string]: GoogleFile;
}

export class GoogleFilesStorage {
  private fileService: FileContentService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: FileMap;

  constructor(private config_dir: string) {
    this.fileService = new FileContentService();
    this.filePath = path.join(config_dir, 'google_files.json');
  }

  async init() {
    this.fileMap = await this.fileService.readJson(this.filePath);
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

  async mergeChanges(files: GoogleFile[], trashed: string[]) {
    for (const id of trashed) {
      await this.removeFile(id);
    }

    for (const file of files) {
      this.fileMap[file.id] = file;
    }

    this.save_needed = true;
  }

  findFile(checker: (f: GoogleFile) => boolean): GoogleFile {
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker: (f: GoogleFile) => boolean): GoogleFile[] {
    const retVal = [];
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
  }

}
