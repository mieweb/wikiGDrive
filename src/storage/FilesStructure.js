'use strict';

import path from 'path';
import fs from 'fs';

import {FileService} from '../utils/FileService';

function generateUniqId() {
  return Math.random().toString(26).slice(2);
}

class FilesStructure {

  constructor(config_dir) {
    this.config_dir = config_dir;
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'files.json');
  }

  async init() {
    await this.loadData();

    process.on('SIGINT', () => {
      this.flushData();
    });
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  getFileMap() {
    return this.fileMap;
  }

  async merge(changedFiles) {
    const mergedFiles = [];

    function pushIfNotInArray(item) {
      if (!mergedFiles.find(x => x.id === item.id)) {
        mergedFiles.push(item);
      }
    }

    for (const file of changedFiles) {
      const oldEntry = this.fileMap[file.id];
      let oldDesiredLocalPath = oldEntry ? oldEntry.desiredLocalPath : '';

      if (!oldEntry) {
        await this._insertFile(file);
      } else {
        await this._updateFile(file);
      }

      if (oldDesiredLocalPath) { // Get all files with oldDesiredLocalPath
        this.findFiles(found => found.desiredLocalPath === oldDesiredLocalPath)
          .forEach(found => {
            pushIfNotInArray(found);
          });
      }

      this.findFiles(found => found.desiredLocalPath === file.desiredLocalPath)
        .forEach(found => { // Get all files with desiredLocalPath
          pushIfNotInArray(found);
        });
    }

    await this.markDirty(mergedFiles);
  }

  async markDirty(files) {
    for (const file of files) {
      if (file.mimeType === FilesStructure.FOLDER_MIME) continue;

      this.fileMap[file.id].dirty = true;
      await this._putFile(file.id, this.fileMap[file.id]);
    }
  }

  async markClean(files) {
    for (const file of files) {
      this.fileMap[file.id].dirty = false;
      await this._putFile(file.id, this.fileMap[file.id]);
    }
  }

  async _updateFile(file) {
    const oldFile = this.fileMap[file.id];

    if (oldFile.desiredLocalPath !== file.desiredLocalPath) {

      const redirectFile = {
        id: generateUniqId(),
        name: oldFile.name,
        mimeType: FilesStructure.REDIRECT_MIME,
        localPath: oldFile.localPath,
        desiredLocalPath: oldFile.desiredLocalPath,
        redirectTo: oldFile.id
      };

      if (oldFile.conflictId) {
        redirectFile.conflictId = oldFile.conflictId;
        delete oldFile.conflictId;
      }

      this.fileMap[redirectFile.id] = redirectFile;
      await this._putFile(redirectFile.id, redirectFile);

      oldFile.desiredLocalPath = file.desiredLocalPath;
    }

    ['name', 'modifiedTime', 'lastAuthor', 'version'].forEach(key => {
      if (file[key]) {
        oldFile[key] = file[key];
      }
    });

    this.fileMap[oldFile.id] = oldFile;
    await this._putFile(oldFile.id, oldFile);

    await this._checkConflicts(oldFile.desiredLocalPath);
    this.save_needed = true;
  }

  async _checkConflicts(desiredLocalPath) {
    const files = this.findFiles(file => file.desiredLocalPath === desiredLocalPath && file.mimeType !== FilesStructure.CONFLICT_MIME);

    if (files.length < 2) {
      files.forEach(file => {
        file.localPath = file.desiredLocalPath;
      });
      return;
    }

    let conflictFile = this.findFile(file => file.desiredLocalPath === desiredLocalPath && file.mimeType === FilesStructure.CONFLICT_MIME);
    if (!conflictFile) {
      conflictFile = {
        id: generateUniqId(),
        name: files[0].name,
        mimeType: FilesStructure.CONFLICT_MIME,
        localPath: desiredLocalPath,
        desiredLocalPath: desiredLocalPath,
        counter: 0,
        conflicting: []
      };
      this.fileMap[conflictFile.id] = conflictFile;
      await this._putFile(conflictFile.id, conflictFile);
    }

    const conflicting = [];

    for (const file of files) {
      if (!file.conflictId) {
        conflictFile.counter++;
        file.conflictId = conflictFile.counter;
      }

      file.localPath = conflictFile.desiredLocalPath.replace('.md', '_' + file.conflictId + '.md');
      this.fileMap[file.id] = file;
      await this._putFile(file.id, file);
      conflicting.push(file.id);
    }

    conflictFile.conflicting = conflicting;
    this.fileMap[conflictFile.id] = conflictFile;
    await this._putFile(conflictFile.id, conflictFile);
  }

  async _insertFile(fileToInsert) {
    delete fileToInsert.conflictId;
    this.fileMap[fileToInsert.id] = fileToInsert;
    await this._putFile(fileToInsert.id, fileToInsert);

    await this._checkConflicts(fileToInsert.desiredLocalPath);
    this.save_needed = true;
  }

  findFile(checker) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker) {
    const retVal = [];
    for (let fileId in this.fileMap) {
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

    for (let fileId in this.fileMap) {
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

  async _putFile(id, file) { // Must be atomic (use fs sync functions)
    this.fileMap[id] = JSON.parse(JSON.stringify(file));
    this.save_needed = true;
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

FilesStructure.FOLDER_MIME = 'application/vnd.google-apps.folder';
FilesStructure.DOCUMENT_MIME = 'application/vnd.google-apps.document';
FilesStructure.DRAWING_MIME = 'application/vnd.google-apps.drawing';

FilesStructure.CONFLICT_MIME = 'conflict';
FilesStructure.REDIRECT_MIME = 'redirect';

export { FilesStructure };
