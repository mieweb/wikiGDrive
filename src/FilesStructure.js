'use strict';

export class FilesStructure {

  constructor(fileMap) {
    this.fileMap = fileMap;
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
    this.fileMap[file.id] = file;
    file.localPath = file.desiredLocalPath;
    return file;
  }

  insertFile(file) {
    this.fileMap[file.id] = file;
    file.localPath = file.desiredLocalPath;
    return file;
  }

}
