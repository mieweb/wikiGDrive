'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {FileService} from '../utils/FileService';

type DateISO = string;
type FileId = string;

function generateUniqId() {
  return Math.random().toString(26).slice(2);
}

export interface LocalFile {
  id: FileId;

  modifiedTime?: DateISO;

  desiredLocalPath: string;
  localPath?: string;

  conflictId?: FileId;
  redirectTo?: FileId;
  conflicting?: FileId[];
  counter?: number;
}

export function isRedirect(file: LocalFile) {
  return !!file.redirectTo;
}

export function isConflict(file: LocalFile) {
  return file.conflicting && file.conflicting.length > 0;
}

function forceGeneration(file: LocalFile) {
  file.modifiedTime = undefined;
}

export interface LocalFileMap {
  [id: string]: LocalFile;
}

export class LocalFilesStorage {
  private fileService: FileService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: LocalFileMap;
  private intervalHandler: NodeJS.Timeout;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'local_files.json');
  }

  async commit(filesToCommit: LocalFile[]) {
    await this.handleRemoval(filesToCommit);
    await this.handleExistingFiles(filesToCommit);
    await this.handleNewFiles(filesToCommit);

    let retry = true;
    while (retry) {
      retry = false;

      await this.removeDanglingRedirects();
      const anyConflictRemoved = await this.handleConflicts();

      if (anyConflictRemoved) {
        retry = true;
      }
    }
  }

  private async handleRemoval(filesToCommit: LocalFile[]) {
    for (const fileId in this.fileMap) {
      const dbFile = this.fileMap[fileId];
      if (isConflict(dbFile)) {
        continue;
      }
      if (isRedirect(dbFile)) {
        continue;
      }
      const found = filesToCommit.find(file => file.id === dbFile.id);
      if (!found) {
        await this.removeMarkDownsAndImages(this.fileMap[fileId].localPath);

        delete this.fileMap[fileId];
        this.save_needed = true;
      }
    }
  }

  private async handleExistingFiles(filesToCommit: LocalFile[]) {
    for (const file of filesToCommit) {
      const dbFile = this.fileMap[file.id];
      if (!dbFile) {
        continue;
      }

      if (dbFile.desiredLocalPath !== file.desiredLocalPath) {
        // Create redir with old desiredLocalPath
        const redirFile: LocalFile = {
          id: dbFile.desiredLocalPath + ':redir:' + file.id,
          desiredLocalPath: dbFile.desiredLocalPath,
          redirectTo: file.id
        };
        this.fileMap[redirFile.id] = redirFile;

        await this.removeMarkDownsAndImages(file.localPath);

        dbFile.desiredLocalPath = file.desiredLocalPath;
        forceGeneration(dbFile);

        this.save_needed = true;
      }
    }
  }

  private async handleNewFiles(filesToCommit: LocalFile[]) {
    for (const file of filesToCommit) {
      const dbFile = this.fileMap[file.id];

      if (!dbFile) {
        this.fileMap[file.id] = {
          id: file.id,
          desiredLocalPath: file.desiredLocalPath,
          modifiedTime: file.modifiedTime,
        };
        this.save_needed = true;
      }
    }
  }

  private async removeDanglingRedirects() {
    let retry = true;

    while (retry) {
      retry = false;

      for (const fileId in this.fileMap) {
        const redirectFile = this.fileMap[fileId];
        if (!isRedirect(redirectFile)) {
          continue;
        }

        if (!this.fileMap[redirectFile.redirectTo]) {
          delete this.fileMap[redirectFile.id];
        }
      }
    }
  }

  private async handleConflicts() {
    let anyConflictRemoved = false;
    const pathGroups = {};

    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (!pathGroups[file.desiredLocalPath]) {
        pathGroups[file.desiredLocalPath] = {
          files: [],
          conflict: undefined
        };
      }

      if (!isConflict(file)) {
        pathGroups[file.desiredLocalPath].files.push(file);
      } else {
        pathGroups[file.desiredLocalPath].conflict = file;
      }
    }

    for (const desiredLocalPath in pathGroups) {
      const files = pathGroups[desiredLocalPath].files;

      if (files.length === 0) {
        continue;
      }
      if (files.length === 1) {
        const conflictFile = pathGroups[desiredLocalPath].conflict;
        if (conflictFile) {
          this.removeMarkDownsAndImages(conflictFile.localPath);
          delete this.fileMap[conflictFile.id];
          anyConflictRemoved = true;

          if (files[0].localPath !== files[0].desiredLocalPath) {
            const redirFile: LocalFile = {
              id: files[0].localPath + ':redir:' + files[0].id,
              desiredLocalPath: files[0].localPath,
              localPath: files[0].localPath,
              redirectTo: files[0].id
            };
            forceGeneration(redirFile);
            this.fileMap[redirFile.id] = redirFile;
          }

          files[0].localPath = files[0].desiredLocalPath;
          forceGeneration(files[0]);
          this.save_needed = true;
        }

        delete files[0].conflictId;
        delete files[0].counter;
        if (files[0].localPath !== files[0].desiredLocalPath) {
          files[0].localPath = files[0].desiredLocalPath;
          forceGeneration(files[0]);
          this.save_needed = true;
        }
        continue;
      }

      if (!pathGroups[desiredLocalPath].conflict) {
        const conflictFile: LocalFile = {
          id: desiredLocalPath + ':conflict',
          desiredLocalPath,
          localPath: desiredLocalPath,
          counter: 1,
          conflicting: files.map(file => file.id)
        };
        pathGroups[desiredLocalPath].conflict = conflictFile;
        this.fileMap[conflictFile.id] = conflictFile;
        this.save_needed = true;
      }

      const conflictFile: LocalFile = pathGroups[desiredLocalPath].conflict;
      for (const file of files) {
        if (!file.conflictId) {
          file.conflictId = conflictFile.id;
          file.counter = conflictFile.counter;

          conflictFile.counter++;
          this.save_needed = true;
        }

        if (file.localPath !== desiredLocalPath + '_' + file.counter) {
          file.localPath = desiredLocalPath + '_' + file.counter;
          forceGeneration(file);
          this.save_needed = true;
        }
      }
    }

    return anyConflictRemoved;
  }

  async init() {
    await this.loadData();
    this.intervalHandler = setInterval(() => {
      this.flushData();
    }, 500);
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

  private async _putFile(id, file) { // Must be atomic (use fs sync functions)
    this.fileMap[id] = JSON.parse(JSON.stringify(file));
    this.save_needed = true;
  }

  private async loadData() {
    try {
      const content = await this.fileService.readFile(this.filePath);
      this.fileMap = JSON.parse(content) || {};
    } catch (error) {
      this.fileMap = {};
    }
  }

  private async flushData() {
    if (!this.save_needed) {
      return ;
    }

    const content = JSON.stringify(this.fileMap, null, 2);
    fs.writeFileSync(this.filePath, content);
    this.save_needed = false;
  }

  private removeMarkDownsAndImages(localPath: string) {
    // TODO Remove all markdowns and images
  }

  async destroy() {
    await this.flushData();
    if (this.intervalHandler) {
      clearInterval(this.intervalHandler);
    }
  }
}
