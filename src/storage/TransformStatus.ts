'use strict';

import * as path from 'path';
import * as fs from 'fs';
import {FileService} from '../utils/FileService';

interface TransformedEntry {
  id: string;
  localPath: string;
  modifiedTime: string;
}

interface TransformedMap {
  [id: string]: TransformedEntry;
}

export class TransformStatus {
  private fileService: FileService;
  private readonly transformPath: string;
  private save_needed: Boolean = false;
  private transformed: TransformedMap;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.transformPath = path.join(config_dir, 'transform.json');
  }

  async init() {
    await this.loadData();

    process.on('SIGINT', () => {
      this.flushData();
    });
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  async addStatus(id, status) {
    this.transformed[id] = status;
    this.save_needed = true;
  }

  async removeStatus(id) {
    if (this.transformed[id]) {
      delete this.transformed[id];
      this.save_needed = true;
    }
  }

  findStatus(checker): TransformedEntry {
    for (let id in this.transformed) {
      const status = this.transformed[id];
      if (checker(status)) {
        return status;
      }
    }
  }

  findStatuses(checker): TransformedEntry[] {
    const retVal = [];
    for (let id in this.transformed) {
      const status = this.transformed[id];
      if (checker(status)) {
        retVal.push(status);
      }
    }
    return retVal;
  }

  private async _loadJson(filePath) {
    try {
      const content = await this.fileService.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  private async loadData() {
    this.transformed = await this._loadJson(this.transformPath) || {};
  }

  async flushData() {
    if (!this.save_needed) {
      return ;
    }

    fs.writeFileSync(this.transformPath,  JSON.stringify(this.transformed, null, 2));
    this.save_needed = false;
  }

}
