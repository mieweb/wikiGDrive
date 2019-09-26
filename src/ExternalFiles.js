'use strict';

import path from 'path';
import fs from 'fs';
import { FileService } from './FileService';

export class ExternalFiles {

  constructor(binaryFiles, httpClient, dest) {
    this.binaryFiles = binaryFiles;
    this.httpClient = httpClient;
    this.dest = dest;
  }

  getBinaryFiles() {
    return this.binaryFiles;
  }

  putFile(file) {
    this.binaryFiles[file.md5Checksum] = file;
  }

  async getMd5(url) {
    return await this.httpClient.md5Url(url);
  }

  async download(url, localPath) {
    const targetPath = path.join(this.dest, localPath);
    const writeStream = fs.createWriteStream(targetPath);

    console.log('Downloading: ' + url + ' -> ' + localPath);

    await this.httpClient.downloadUrl(url, writeStream);

    const fileService = new FileService();
    const md5 = await fileService.md5File(targetPath);

    this.putFile({
      localPath: localPath,
      md5Checksum: md5
    });

    return localPath;
  }

  findFile(checker) {
    for (let fileId in this.binaryFiles) {
      const file = this.binaryFiles[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker) {
    const retVal = [];
    for (let fileId in this.binaryFiles) {
      const file = this.binaryFiles[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
  }


}
