'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as winston from 'winston';
import {FileService} from '../utils/FileService';
import {HttpClient} from '../utils/HttpClient';

function createTempName(tmpdir) {
  const filename = 'temp_' + crypto.randomBytes(4).readUInt32LE(0) + '_ext';
  return path.join(tmpdir, filename);
}

export interface BinaryFileEntry {
  localPath: string;
  localDocumentPath?: string;
  md5Checksum: string;
}

export interface BinaryFilesMap {
  [id: string]: BinaryFileEntry;
}

export interface LinkEntry {
  url: string;
  md5Checksum: string;
}

export interface LinksMap {
  [id: string]: LinkEntry;
}

export class ExternalFiles {
  private fileService: FileService;
  private readonly linksPath: string;
  private readonly filePath: string;
  private save_needed = false;
  private binaryFiles: BinaryFilesMap;
  private links: LinksMap;
  private logger: winston.Logger;

  constructor(logger, private config_dir: string, private httpClient: HttpClient, private dest: string) {
    this.logger = logger.child({ filename: __filename });
    this.fileService = new FileService();
    this.linksPath = path.join(config_dir, 'links.json');
    this.filePath = path.join(config_dir, 'external_files.json');
  }

  async init() {
    if (!fs.existsSync(path.join(this.dest, 'external_files'))) {
      fs.mkdirSync(path.join(this.dest, 'external_files'), { recursive: true });
    }
    await this.loadData();
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  async putFile(file: BinaryFileEntry) {
    this.binaryFiles[file.md5Checksum] = file;
    this.save_needed = true;
  }

  async addLink(url: string, link: LinkEntry) {
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      return;
    }

    if (!link.md5Checksum && url in this.links) {
      return;
    }

    this.links[url] = link;

    this.save_needed = true;
  }

  async getMd5(url: string): Promise<string> {
    return await this.httpClient.md5Url(url);
  }

  async downloadTemp(url: string, dir: string): Promise<string> {
    const targetPath = createTempName(dir);
    const writeStream = fs.createWriteStream(targetPath);

    this.logger.info('Downloading file: ' + url + ' -> ' + targetPath);

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

  findFile(checker): BinaryFileEntry {
    for (const fileId in this.binaryFiles) {
      const file = this.binaryFiles[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker): BinaryFileEntry[] {
    const retVal = [];
    for (const fileId in this.binaryFiles) {
      const file = this.binaryFiles[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
  }

  findLink(checker): LinkEntry {
    for (const id in this.links) {
      const link = this.links[id];
      if (checker(link)) {
        return link;
      }
    }
  }

  findLinks(checker): LinkEntry[] {
    const retVal = [];
    for (const id in this.links) {
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

  getDest() {
    return this.dest;
  }
}
