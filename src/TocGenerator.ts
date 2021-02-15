'use strict';

import * as path from 'path';
import { FilesStructure } from './storage/FilesStructure';
import {LinkTranslator} from './LinkTranslator';

export class TocGenerator {
  private readonly localPath: string;
  private linkTranslator: LinkTranslator;

  constructor(localPath, linkTranslator) {
    this.localPath = localPath;
    this.linkTranslator = linkTranslator;
  }

  addLevels(fileMap) {
    const copy = {};

    for (const id in fileMap) {
      copy[id] = fileMap[id];
      copy[id].level = copy[id].localPath.split(path.sep).length - 1;
    }

    return copy;
  }

  sortLevel(files) {
    return files.sort((file1, file2) => {
      if ((file1.mimeType === FilesStructure.FOLDER_MIME) && (file2.mimeType !== FilesStructure.FOLDER_MIME)) {
        return -1;
      }
      if ((file1.mimeType !== FilesStructure.FOLDER_MIME) && (file2.mimeType === FilesStructure.FOLDER_MIME)) {
        return 1;
      }

      return file1.name.toLocaleLowerCase().localeCompare(file2.name.toLocaleLowerCase());
    });
  }

  getDir(fileMap, level, prefix) {
    const arr = [];
    for (const id in fileMap) {
      const file = fileMap[id];
      if (file.localPath.startsWith(prefix) && file.level === level) {
        arr.push(file);
      }
    }
    return this.sortLevel(arr);
  }

  async outputDir(fileMap, writeStream, level, prefix) {
    const rootDir = this.getDir(fileMap, level, prefix);

    for (let dirNo = 0; dirNo < rootDir.length; dirNo++) {
      const file = rootDir[dirNo];
      let lineStart = '*';
      for (let i = 0; i <= level; i++) {
        lineStart = ' ' + lineStart;
      }

      if (file.mimeType === FilesStructure.FOLDER_MIME) {
        await new Promise(resolve => writeStream.write(lineStart + ' ' + file.name + '\n', resolve));
        await this.outputDir(fileMap, writeStream, level + 1, file.localPath + path.sep);
      } else
      if (file.mimeType === FilesStructure.DOCUMENT_MIME) {
        const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(file.localPath, this.localPath);
        await new Promise(resolve => writeStream.write(lineStart + ' [' + file.name + '](' + (relativePath) + ')\n', resolve));
      }
    }
  }

  async generate(filesStructure, writeStream) {
    const fileMap = filesStructure.getFileMap();
    let frontMatter = '---\n';
    frontMatter += 'type: page\n';
    frontMatter += '---\n';

    await new Promise(resolve => writeStream.write(frontMatter, resolve));

    const fileMapCopy = this.addLevels(fileMap);
    await this.outputDir(fileMapCopy, writeStream, 0, '');
  }

}
