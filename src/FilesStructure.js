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

      if (!oldEntry) {
        file = this.insertFile(file);
      } else {
        file = this.updateFile(file);
      }

      if (file) {
        mergedFiles.push(file);
      }
    });

    return mergedFiles;
  }

  updateFile(file) {
    file = this.fileMap[file.id];
    // TODO handle confilct after move
    //this.fileMap[file.id] = file;
    return file;
  }

  insertFile(fileToInsert) {
    this.fileMap[fileToInsert.id] = fileToInsert;

    const existingFile = this.getFileByLocalPath(fileToInsert.desiredLocalPath);
    if (existingFile) {
      if (existingFile.mimeType === FilesStructure.CONFLICT_MIME) {
        const fileConflict = existingFile;

        fileConflict.counter++;
        fileToInsert.localPath = fileConflict.desiredLocalPath.replace('.md', '_'+ fileConflict.counter + '.md');
        fileConflict.conflicting.push(fileToInsert.id);
        this.fileMap[fileToInsert.id] = fileToInsert;
      } else {
        const uniqId = Math.random().toString(26).slice(2);

        const fileConflict = {
          id: uniqId,
          name: existingFile.name,
          mimeType: FilesStructure.CONFLICT_MIME,
          localPath: fileToInsert.desiredLocalPath,
          desiredLocalPath: fileToInsert.desiredLocalPath,
          counter: 0,
          conflicting: []
        };
        this.fileMap[fileConflict.id] = fileConflict;

        fileConflict.counter++;
        existingFile.localPath = fileConflict.desiredLocalPath.replace('.md', '_'+ fileConflict.counter + '.md');
        fileConflict.conflicting.push(existingFile.id);
        this.fileMap[existingFile.id] = existingFile;

        fileConflict.counter++;
        fileToInsert.localPath = fileConflict.desiredLocalPath.replace('.md', '_'+ fileConflict.counter + '.md');
        fileConflict.conflicting.push(fileToInsert.id);
        this.fileMap[fileToInsert.id] = fileToInsert;
      }
    } else {
      fileToInsert.localPath = fileToInsert.desiredLocalPath;
      this.fileMap[fileToInsert.id] = fileToInsert;
    }

    return fileToInsert;
  }

  getFileByLocalPath(localPath) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];
      if (file.localPath === localPath) {
        return file;
      }
    }
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

}

FilesStructure.FOLDER_MIME = 'application/vnd.google-apps.folder';
FilesStructure.DOCUMENT_MIME = 'application/vnd.google-apps.document';
FilesStructure.DRAWING_MIME = 'application/vnd.google-apps.drawing';

FilesStructure.CONFLICT_MIME = 'conflict';
FilesStructure.REDIRECT_MIME = 'redirect';

export {FilesStructure};
