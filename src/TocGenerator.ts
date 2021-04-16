'use strict';

import {LinkTranslator} from './LinkTranslator';
import {LocalFile, LocalFilesStorage} from './storage/LocalFilesStorage';

function isFolder(file: LocalFile) {
  return file.localPath.indexOf('.') === -1;
}

function isDocument(file: LocalFile) {
  return file.localPath.endsWith('.md') || file.localPath.endsWith('.html');
}

interface LocalFileWithLevel extends LocalFile {
  level: number;
}

interface LocalFileWithLevelMap {
  [k: string]: LocalFileWithLevel;
}

export class TocGenerator {
  constructor(private localPath: string, private linkTranslator: LinkTranslator, private localFilesStorage: LocalFilesStorage) {
  }

  addLevels(files: LocalFile[]) {
    const copy = {};

    for (const file of files) {
      copy[file.id] = file;
      copy[file.id].level = file.localPath.split('/').length - 2;
    }

    return copy;
  }

  sortLevel(files: LocalFile[]) {
    return files.sort((file1, file2) => {
      if (isFolder(file1) && !isFolder(file2)) {
        return -1;
      }
      if (!isFolder(file1) && isFolder(file2)) {
        return 1;
      }

      return file1.name.toLocaleLowerCase().localeCompare(file2.name.toLocaleLowerCase());
    });
  }

  async outputDir(fileMap: LocalFileWithLevelMap, level, prefix) {
    const rootDir = this.getDir(fileMap, level, prefix);

    let markdown = '';

    for (let dirNo = 0; dirNo < rootDir.length; dirNo++) {
      const file = rootDir[dirNo];
      let lineStart = '*';
      for (let i = 0; i <= level; i++) {
        lineStart = ' ' + lineStart;
      }

      if (isFolder(file)) {
        markdown += lineStart + ' ' + file.name + '\n';
        markdown += await this.outputDir(fileMap,  level + 1, file.localPath + '/');
      } else
      if (isDocument(file)) {
        const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(file.localPath, this.localPath);
        markdown += lineStart + ' [' + file.name + '](' + (relativePath) + ')\n';
      }
    }

    return markdown;
  }

  getDir(fileMap: LocalFileWithLevelMap, level, prefix) {
    const arr = [];

    for (const id in fileMap) {
      const file = fileMap[id];
      if (file.localPath.startsWith(prefix) && file.level === level) {
        arr.push(file);
      }
    }

    return this.sortLevel(arr);
  }

  async generate() {
    const files = this.localFilesStorage.findFiles(file => !!file.localPath);

    const fileMapCopy = this.addLevels(files);
    const markdown = await this.outputDir(fileMapCopy, 0, '');

    let frontMatter = '---\n';
    frontMatter += 'type: page\n';
    frontMatter += '---\n';

    return frontMatter + markdown;
  }

}
