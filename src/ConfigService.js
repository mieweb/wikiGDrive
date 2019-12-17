'use strict';

import { FileService } from './FileService';

export class ConfigService {

  constructor(filePath) {
    this.fileService = new FileService();
    this.filePath = filePath;
  }

  async loadConfig() {
    try {
      const content = await this.fileService.readFile(this.filePath);
      const config = JSON.parse(content);
      return config;
    } catch (error) {
      return {};
    }
  }

  async saveConfig(config) {
    const content = JSON.stringify(config, null, 2);
    return this.fileService.writeFile(this.filePath, content);
  }

  async resetConfig(section) {
    if (!section || !section.trim()) {
      return;
    }

    if (!await this.fileService.exists(this.filePath)) {
      throw 'Config file .wikigdrive does not exists';
    }

    section = section.split('.');

    const config = await this.loadConfig();

    for (const key of section) {
      delete config[key.trim()];
    }

    await this.saveConfig(config);
  }
}
