'use strict';

import path from 'path';

export class TocGenerator {

  addLevels(fileMap) {
    const copy = {};

    for (let id in fileMap) {
      copy[id] = fileMap[id];
      copy[id].level = copy[id].localPath.split(path.sep).length - 1;
    }

    return copy;
  }

  sortLevel(files) {
    return files.sort((file1, file2) => {
      if ((file1.mimeType === 'application/vnd.google-apps.folder') && (file2.mimeType !== 'application/vnd.google-apps.folder')) {
        return -1;
      }
      if ((file1.mimeType !== 'application/vnd.google-apps.folder') && (file2.mimeType === 'application/vnd.google-apps.folder')) {
        return 1;
      }

      return file1.name.toLocaleLowerCase().localeCompare(file2.name.toLocaleLowerCase());
    });
  }

  getDir(fileMap, level, prefix) {
    const arr = [];
    for (let id in fileMap) {
      const file = fileMap[id];
      if (file.localPath.startsWith(prefix) && file.level === level) {
        arr.push(file);
      }
    }
    return this.sortLevel(arr);
  }

  outputDir(fileMap, writeStream, level, prefix) {
    const rootDir = this.getDir(fileMap, level, prefix);
    rootDir.forEach((file) => {
      let lineStart = '*';
      for (let i = 0; i <= level; i++) {
        lineStart = ' ' + lineStart;
      }

      if (file.mimeType === 'application/vnd.google-apps.folder') {
        writeStream.write(lineStart + ' ' + file.name + '\n');
        this.outputDir(fileMap, writeStream, level + 1, file.localPath + path.sep);
      } else {
        const localPath = (file.htmlPath || file.localPath);
        writeStream.write(lineStart + ' [' + file.name + '](' + (localPath) + ')\n');
      }
    });
    console.log(rootDir);
  }

  generate(fileMap, writeStream, htmlPath) {
    let frontMatter = '---\n';
    if (htmlPath) {
      frontMatter += 'url: "' + htmlPath + '"\n';
    }
    frontMatter += 'type: page\n';
    frontMatter += '---\n';

    writeStream.write(frontMatter);

    fileMap = this.addLevels(fileMap);
    this.outputDir(fileMap, writeStream, 0, '');
    writeStream.end();
  }

}
