'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as winston from 'winston';
import {HttpClient} from '../utils/HttpClient';
import {FileContentService} from '../utils/FileContentService';

function createTempName(tmpdir) {
  const filename = 'temp_' + crypto.randomBytes(4).readUInt32LE(0) + '_ext';
  return path.join(tmpdir, filename);
}

export interface ExternalFile {
  md5Checksum: string;
  ext: string;
  urls: string[];
}

export interface ExternalFilesMap {
  [md5Checksum: string]: ExternalFile;
}

export class ExternalFilesStorage {
  private fileService: FileContentService;
  private readonly filePath: string;
  private save_needed = false;
  private externalFiles: ExternalFilesMap;
  private logger: winston.Logger;

  constructor(logger, private config_dir: string, private httpClient: HttpClient) {
    this.logger = logger.child({ filename: __filename });
    this.fileService = new FileContentService();
    this.filePath = path.join(config_dir, 'external_files.json');
  }

  async init() {
    await this.loadData();
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  async addUrl(url, md5Checksum, ext) {
    if (!this.externalFiles[md5Checksum]) {
      this.externalFiles[md5Checksum] = {
        md5Checksum,
        ext,
        urls: [url]
      };
    } else {
      if (this.externalFiles[md5Checksum].urls.indexOf(url) === -1) {
        this.externalFiles[md5Checksum].urls.push(url);
      }
    }
    this.save_needed = true;
  }

  async downloadTemp(url: string, dir: string): Promise<string> {
    const targetPath = createTempName(dir);
    const writeStream = fs.createWriteStream(targetPath);

    this.logger.info('Downloading file: ' + url + ' -> ' + targetPath);

    await this.httpClient.downloadUrl(url, writeStream);

    return targetPath;
  }

  findFile(checker): ExternalFile {
    for (const fileId in this.externalFiles) {
      const file = this.externalFiles[fileId];
      if (checker(file)) {
        return file;
      }
    }
  }

  findFiles(checker: (file: ExternalFile) => boolean): ExternalFile[] {
    const retVal = [];
    for (const fileId in this.externalFiles) {
      const file = this.externalFiles[fileId];
      if (checker(file)) {
        retVal.push(file);
      }
    }
    return retVal;
  }

  private async loadData() {
    this.externalFiles = await this.fileService.readJson(this.filePath);
  }

  async flushData() {
    if (!this.save_needed) {
      return ;
    }

    await this.fileService.writeJson(this.filePath, this.externalFiles);
    this.save_needed = false;
  }

}
