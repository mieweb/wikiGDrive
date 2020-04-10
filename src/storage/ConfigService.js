'use strict';

import { FileService } from '../utils/FileService';

export class ConfigService {

  constructor(filePath) {
    this.fileService = new FileService();
    this.filePath = filePath;
  }

  async flush() {
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

  async loadCredentials() {
    const config = await this._loadConfig();
    return config.credentials;
  }

  async loadGoogleAuth() {
    const config = await this._loadConfig();
    return config.google_auth;
  }

  async loadFileMap() {
    const config = await this._loadConfig();
    return config.fileMap;
  }

  async saveFileMap(fileMap) {
    const config = await this._loadConfig();
    config.fileMap = fileMap;
    await this._saveConfig(config);
  }

  async loadBinaryFiles() {
    const config = await this._loadConfig();
    return config.binaryFiles || {};
  }

  async saveBinaryFiles(binaryFiles) {
    const config = await this._loadConfig();
    config.binaryFiles = binaryFiles;
    await this._saveConfig(config);
  }

  async saveGoogleAuth(google_auth) {
    const config = await this._loadConfig();
    config.google_auth = google_auth;
    await this._saveConfig(config);
  }

  async resetConfig(section) {
    if (!section || !section.trim()) {
      return;
    }

    if (!await this.fileService.exists(this.filePath)) {
      throw 'Config file .wikigdrive does not exists';
    }

    section = section.split('.');

    const config = await this._loadConfig();

    for (const key of section) {
      delete config[key.trim()];
    }

    await this._saveConfig(config);
  }
}
