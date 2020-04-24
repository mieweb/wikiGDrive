'use strict';

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

function createTempName(tmpdir) {
  const filename = 'temp_' + crypto.randomBytes(4).readUInt32LE(0) + '_ext';
  return path.join(tmpdir, filename);
}

export class ExternalFiles {

  constructor(configService, httpClient, dest) {
    this.configService = configService;
    this.httpClient = httpClient;
    this.dest = dest;
  }

  async init() {
    this.binaryFiles = await this.configService.loadBinaryFiles();
  }

  async putFile(file) {
    this.binaryFiles[file.md5Checksum] = file;
    await this.configService.putBinaryFile(file.md5Checksum, file);
  }

  async getMd5(url) {
    return await this.httpClient.md5Url(url);
  }

  async downloadTemp(url, dir) {
    const targetPath = createTempName(dir);
    const writeStream = fs.createWriteStream(targetPath);

    console.log('Downloading file: ' + url + ' -> ' + targetPath);

    await this.httpClient.downloadUrl(url, writeStream);

    return targetPath;
  }

  async cleanup() {
    const tempPath = path.join(this.dest, 'external_files');

    if (!fs.existsSync(tempPath)) {
      return;
    }

    const files = fs.readdirSync(tempPath);
    for (const file of files) {
      if (file.startsWith('temp_') && file.endsWith('_ext')) {
        fs.unlinkSync(path.join(tempPath, file));
      }
    }
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
