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


  async saveGoogleAuth(google_auth) {
    const config = await this._loadConfig();
    config.google_auth = google_auth;
    await this._saveConfig(config);
  }

}
