'use strict';

class FilesStructure {

  constructor(fileMap) {
    this.fileMap = fileMap || {};
  }

  getFileMap() {
    return this.fileMap;
  }

  merge(files) {
    const mergedFiles = [];

    files.forEach(file => {
      const oldEntry = this.fileMap[file.id];
      let oldDesiredLocalPath = oldEntry ? oldEntry.desiredLocalPath : '';

      if (!oldEntry) {
        this.insertFile(file);
      } else {
        this.updateFile(file);
      }

      if (oldDesiredLocalPath) {
        this.findFiles(found => found.desiredLocalPath === oldDesiredLocalPath)
          .forEach(found => {
            if (!mergedFiles.find(x => x.id === found.id)) {
              mergedFiles.push(found);
            }
          });
      }

      this.findFiles(found => found.desiredLocalPath === file.desiredLocalPath)
        .forEach(found => {
          if (!mergedFiles.find(x => x.id === found.id)) {
            mergedFiles.push(found);
          }
        });
    });

    return mergedFiles;
  }

  updateFile(file) {
    const oldFile = this.fileMap[file.id];

    if (oldFile.desiredLocalPath !== file.desiredLocalPath) {

      const redirectFile = {
        id: this.generateUniqId(),
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

      oldFile.desiredLocalPath = file.desiredLocalPath;
    }

    ['name', 'modifiedTime', 'lastAuthor'].forEach(key => {
      if (file[key]) {
        oldFile[key] = file[key];
      }
    });

    this.fileMap[oldFile.id] = oldFile;

    this.checkConflicts(oldFile.desiredLocalPath);
  }

  checkConflicts(desiredLocalPath) {
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
        id: this.generateUniqId(),
        name: files[0].name,
        mimeType: FilesStructure.CONFLICT_MIME,
        localPath: desiredLocalPath,
        desiredLocalPath: desiredLocalPath,
        counter: 0,
        conflicting: []
      };
      this.fileMap[conflictFile.id] = conflictFile;
    }

    const conflicting = [];

    files.forEach(file => {
      if (!file.conflictId) {
        conflictFile.counter++;
        file.conflictId = conflictFile.counter;
      }

      file.localPath = conflictFile.desiredLocalPath.replace('.md', '_' + file.conflictId + '.md');
      this.fileMap[file.id] = file;
      conflicting.push(file.id);
    });

    conflictFile.conflicting = conflicting;
    this.fileMap[conflictFile.id] = conflictFile;
  }

  insertFile(fileToInsert) {
    delete fileToInsert.conflictId;
    this.fileMap[fileToInsert.id] = fileToInsert;

    this.checkConflicts(fileToInsert.desiredLocalPath);
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

  generateUniqId() {
    return Math.random().toString(26).slice(2);
  }

}

FilesStructure.FOLDER_MIME = 'application/vnd.google-apps.folder';
FilesStructure.DOCUMENT_MIME = 'application/vnd.google-apps.document';
FilesStructure.DRAWING_MIME = 'application/vnd.google-apps.drawing';

FilesStructure.CONFLICT_MIME = 'conflict';
FilesStructure.REDIRECT_MIME = 'redirect';

export { FilesStructure };
