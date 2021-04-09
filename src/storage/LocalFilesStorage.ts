'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {FileService} from '../utils/FileService';

type DateISO = string;
type FileId = string;

export interface TransformHandler {
  removeMarkDownsAndImages(localFile: LocalFile): Promise<void>;
  forceGeneration(localFile: LocalFile): Promise<void>;
  beforeSave(): Promise<boolean>;
}

class VoidTransformHandler implements TransformHandler {
  async removeMarkDownsAndImages(localFile: LocalFile): Promise<void> {
    return Promise.resolve();
  }
  async forceGeneration(localFile: LocalFile) {
    localFile.modifiedTime = undefined;
  }
  async beforeSave() {
    return true;
  }
}

export interface LocalFile {
  id: FileId;
  name: string;

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

export interface LocalFileMap {
  [id: string]: LocalFile;
}

export class LocalFilesStorage {
  private fileService: FileService;
  private readonly filePath: string;
  // private save_needed = false;

  private fileMap: LocalFileMap;
  private intervalHandler: NodeJS.Timeout;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'local_files.json');
  }

  async commit(filesToCommit: LocalFile[], transformHandler: TransformHandler = new VoidTransformHandler()) {
    await this.handleRemoval(filesToCommit, transformHandler);
    await this.handleExistingFiles(filesToCommit, transformHandler);
    await this.handleNewFiles(filesToCommit, transformHandler);

    let retry = true;
    while (retry) {
      retry = false;

      await this.removeDanglingRedirects();
      const anyConflictRemoved = await this.handleConflicts(transformHandler);

      if (anyConflictRemoved) {
        retry = true;
      }
    }

    if (!await transformHandler.beforeSave()) {
      return;
    }

    const content = JSON.stringify(this.fileMap, null, 2);
    fs.writeFileSync(this.filePath, content);
  }

  private async handleRemoval(filesToCommit: LocalFile[], transformHandler: TransformHandler) {
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
        await transformHandler.removeMarkDownsAndImages(this.fileMap[fileId]);
        delete this.fileMap[fileId];
      }
    }
  }

  private async handleExistingFiles(filesToCommit: LocalFile[], transformHandler: TransformHandler) {
    for (const file of filesToCommit) {
      const dbFile = this.fileMap[file.id];
      if (!dbFile) {
        continue;
      }

      if (dbFile.desiredLocalPath !== file.desiredLocalPath) {
        // Create redir with old desiredLocalPath
        const redirFile: LocalFile = {
          name: dbFile.name,
          id: dbFile.desiredLocalPath + ':redir:' + file.id,
          desiredLocalPath: dbFile.desiredLocalPath,
          redirectTo: file.id
        };
        this.fileMap[redirFile.id] = redirFile;

        await transformHandler.removeMarkDownsAndImages(file);

        dbFile.desiredLocalPath = file.desiredLocalPath;
        dbFile.name = file.name;
        await transformHandler.forceGeneration(dbFile);
      }
    }
  }

  private async handleNewFiles(filesToCommit: LocalFile[], transformHandler: TransformHandler) {
    for (const file of filesToCommit) {
      const dbFile = this.fileMap[file.id];

      if (!dbFile) {
        this.fileMap[file.id] = {
          id: file.id,
          name: file.name,
          desiredLocalPath: file.desiredLocalPath,
          modifiedTime: file.modifiedTime,
        };
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

  private async handleConflicts(transformHandler: TransformHandler) {
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
          await transformHandler.removeMarkDownsAndImages(conflictFile.localPath);
          delete this.fileMap[conflictFile.id];
          anyConflictRemoved = true;

          if (files[0].localPath !== files[0].desiredLocalPath) {
            const redirFile: LocalFile = {
              id: files[0].localPath + ':redir:' + files[0].id,
              name: files[0].name,
              desiredLocalPath: files[0].localPath,
              localPath: files[0].localPath,
              redirectTo: files[0].id
            };
            await transformHandler.forceGeneration(redirFile);
            this.fileMap[redirFile.id] = redirFile;
          }

          files[0].localPath = files[0].desiredLocalPath;
          await transformHandler.forceGeneration(files[0]);
        }

        delete files[0].conflictId;
        delete files[0].counter;
        if (files[0].localPath !== files[0].desiredLocalPath) {
          files[0].localPath = files[0].desiredLocalPath;
          await transformHandler.forceGeneration(files[0]);
        }
        continue;
      }

      if (!pathGroups[desiredLocalPath].conflict) {
        const conflictFile: LocalFile = {
          id: desiredLocalPath + ':conflict',
          name: 'Conflict: ' + files[0].name,
          desiredLocalPath,
          localPath: desiredLocalPath,
          counter: 1,
          conflicting: files.map(file => file.id)
        };
        pathGroups[desiredLocalPath].conflict = conflictFile;
        this.fileMap[conflictFile.id] = conflictFile;
      }

      const conflictFile: LocalFile = pathGroups[desiredLocalPath].conflict;
      for (const file of files) {
        if (!file.conflictId) {
          file.conflictId = conflictFile.id;
          file.counter = conflictFile.counter;

          conflictFile.counter++;
        }

        if (file.localPath !== desiredLocalPath + '_' + file.counter) {
          file.localPath = desiredLocalPath + '_' + file.counter;
          await transformHandler.forceGeneration(file);
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

  findFile(checker: (f: LocalFile) => boolean): LocalFile {
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker: (f: LocalFile) => boolean): LocalFile[] {
    const retVal = [];
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
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
    // if (!this.save_needed) {
    //   return ;
    // }
    // const content = JSON.stringify(this.fileMap, null, 2);
    // fs.writeFileSync(this.filePath, content);
    // this.save_needed = false;
  }

  async destroy() {
    // await this.flushData();
    if (this.intervalHandler) {
      clearInterval(this.intervalHandler);
    }
  }
}
