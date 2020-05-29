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

    process.on('SIGINT', () => {
      this.flushData();
    });
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  async putFile(file) {
    this.binaryFiles[file.md5Checksum] = file;
    this.save_needed = true;
  }

  async addLink(url, link) {
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      return;
    }

    if (!link.md5 && url in this.links) {
      return;
    }

    this.links[url] = link;

    this.save_needed = true;
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

  findLink(checker) {
    for (let id in this.links) {
      const link = this.links[id];
      if (checker(link)) {
        return link;
      }
    }
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

  async flushData() {
    if (!this.save_needed) {
      return ;
    }

    fs.writeFileSync(this.filePath,  JSON.stringify(this.binaryFiles, null, 2));
    fs.writeFileSync(this.linksPath,  JSON.stringify(this.links, null, 2));
    this.save_needed = false;
  }

}
