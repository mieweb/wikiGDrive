'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {FileService} from '../utils/FileService';
import {GoogleFile, MimeTypes} from './GoogleFilesStorage';
import {LocalPathGenerator} from './LocalPathGenerator';

type DateISO = string;
type FileId = string;

function generateUniqId() {
  return Math.random().toString(26).slice(2);
}

export interface LocalFile {
  id: FileId;

//  name: string;
  modifiedTime?: DateISO;

  desiredLocalPath: string;
  localPath: string;

  mimeType: string;

  conflictId?: FileId;
  redirectTo?: FileId;
  conflicting?: FileId[];
  counter?: number;
}

export interface LocalFileMap {
  [id: string]: LocalFile;
}

export class LocalFiles {
  private fileService: FileService;
  private readonly filePath: string;
  private save_needed = false;

  private fileMap: LocalFileMap;

  constructor(private config_dir: string, private flat_folder_structure: boolean = false) {
    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'local_files.json');
  }

  async init() {
    await this.loadData();
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  private async _checkConflicts(desiredLocalPath) {
    const files = this.findFiles(file => file.desiredLocalPath === desiredLocalPath && file.mimeType !== MimeTypes.CONFLICT_MIME && !file.trashed);

    if (files.length < 2) {
      files.forEach(file => {
        file.localPath = file.desiredLocalPath;
      });
      return;
    }

    let conflictFile = this.findFile(file => file.desiredLocalPath === desiredLocalPath && file.mimeType === MimeTypes.CONFLICT_MIME && !file.trashed);
    if (!conflictFile) {
      conflictFile = {
        id: generateUniqId(),
        name: files[0].name,
        mimeType: MimeTypes.CONFLICT_MIME,
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








/// XXXXXXXXXXXXXXXXXXXXXXXXx




  async merge(changedFiles) {
    const mergedFiles = [];

    function pushIfNotInArray(item) {
      if (!mergedFiles.find(x => x.id === item.id)) {
        mergedFiles.push(item);
      }
    }

    for (const file of changedFiles) {
      if (file.trashed) {
        await this._updateFile(file);
      }
    }

    const localPathGenerator = new LocalPathGenerator(this, this.flat_folder_structure);
    changedFiles = localPathGenerator.generateDesiredPaths(changedFiles);

    for (const file of changedFiles) {
      const oldEntry = this.fileMap[file.id];
      const oldDesiredLocalPath = oldEntry ? oldEntry.desiredLocalPath : '';

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
      if (file.mimeType === MimeTypes.FOLDER_MIME) continue;
      await this._putFile(file.id, Object.assign({}, this.fileMap[file.id], {
        dirty: true
      }));
    }
  }

  async markClean(files: GoogleFile[]) {
    for (const file of files) {
      this.fileMap[file.id].dirty = false;
      if (file.modifiedTime) {
        this.fileMap[file.id].modifiedTime = file.modifiedTime;
      }
      await this._putFile(file.id, Object.assign({}, this.fileMap[file.id], {
        dirty: false
      }));
    }
  }

  async _updateFile(file) {
    const oldFile = this.fileMap[file.id];

    if (oldFile.desiredLocalPath !== file.desiredLocalPath) {

      const redirectFile: GoogleFile = {
        id: generateUniqId(),
        name: oldFile.name,
        mimeType: MimeTypes.REDIRECT_MIME,
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

    ['name', 'modifiedTime', 'lastAuthor', 'version', 'trashed'].forEach(key => {
      if (key in file) {
        oldFile[key] = file[key];
      }
    });

    this.fileMap[oldFile.id] = oldFile;
    await this._putFile(oldFile.id, oldFile);

    await this._checkConflicts(oldFile.desiredLocalPath);
    this.save_needed = true;
  }

  async _insertFile(fileToInsert) {
    delete fileToInsert.conflictId;
    this.fileMap[fileToInsert.id] = fileToInsert;
    await this._putFile(fileToInsert.id, fileToInsert);

    await this._checkConflicts(fileToInsert.desiredLocalPath);
    this.save_needed = true;
  }

}

