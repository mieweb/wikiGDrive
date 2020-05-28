'use strict';

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {FileService} from '../utils/FileService';

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
    this.linksPath = path.join(config_dir, 'links.json');
    this.filePath = path.join(config_dir, 'external_files.json');
  }

  async init() {
    fs.mkdirSync(path.join(this.dest, 'external_files'), { recursive: true });
    await this.loadData();
  }

  async putFile(file) {
    this.binaryFiles[file.md5Checksum] = file;
    await this.saveData();
  }


  async addLink(url, link) {
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      return;
    }

    if (!link.md5 && url in this.links) {
      return;
    }

    this.links[url] = link;

    await this.saveData();
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

  findLinks(checker) {
    const retVal = [];
    for (let id in this.links) {
      const link = this.links[id];
      if (checker(link)) {
        retVal.push(link);
      }
    }
    return retVal;
  }

  async _loadJson(filePath) {
    try {
      const content = await this.fileService.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  async loadData() {
    this.binaryFiles = await this._loadJson(this.filePath) || {};
    this.links = await this._loadJson(this.linksPath) || {};
  }

  async saveData() {
    await this.fileService.writeFile(this.filePath, JSON.stringify(this.binaryFiles, null, 2)); // TODO debounce
    await this.fileService.writeFile(this.linksPath, JSON.stringify(this.links, null, 2)); // TODO debounce
  }

}
