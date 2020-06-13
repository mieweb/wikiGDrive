'use strict';

import path from 'path';
import fs from 'fs';
import {FileService} from '../utils/FileService';

export class TransformStatus {

  constructor(config_dir) {
    this.config_dir = config_dir;

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

  findStatus(checker) {
    for (let id in this.transformed) {
      const status = this.transformed[id];
      if (checker(status)) {
        return status;
      }
    }
  }

  findStatuses(checker) {
    const retVal = [];
    for (let id in this.transformed) {
      const status = this.transformed[id];
      if (checker(status)) {
        retVal.push(status);
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
