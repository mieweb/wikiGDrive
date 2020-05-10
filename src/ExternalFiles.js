'use strict';

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {FileService} from './utils/FileService';

function createTempName(tmpdir) {
  const filename = 'temp_' + crypto.randomBytes(4).readUInt32LE(0) + '_ext';
  return path.join(tmpdir, filename);
}

export class ExternalFiles {

  constructor(config_dir, httpClient, dest) {
    this.config_dir = config_dir;
    this.httpClient = httpClient;
    this.dest = dest;

    this.fileService = new FileService();
    this.filePath = path.join(config_dir, 'external_files.json');
  }

  async init() {
    this.binaryFiles = await this.loadBinaryFiles();
  }

  async putFile(file) {
    this.binaryFiles[file.md5Checksum] = file;

    const id = file.md5Checksum;

    const config = await this._loadConfig();
    config.binaryFiles = config.binaryFiles || {};
    config.binaryFiles[id] = file;
    await this._saveConfig(config);
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

  async loadBinaryFiles() {
    const config = await this._loadConfig();
    return config.binaryFiles || {};
  }

  async _loadConfig() {
    try {
      const content = await this.fileService.readFile(this.filePath);
      const config = JSON.parse(content);
      return config;
    } catch (error) {
      return {};
    }
  }

  async _saveConfig(config) {
    const content = JSON.stringify(config, null, 2);
    return this.fileService.writeFile(this.filePath, content);
  }

}
