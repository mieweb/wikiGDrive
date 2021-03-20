'use strict';

import { FileService } from '../utils/FileService';
import * as fs from 'fs';
import * as path from 'path';

export interface GoogleAuth {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface Config {
  google_auth: GoogleAuth;
}

export class ConfigService {
  private save_needed = false;
  private fileService: FileService;
  private config: Config;
  private readonly authPath: string;

  constructor(private config_dir: string) {
    this.fileService = new FileService();
    this.authPath = path.join(config_dir, 'google_auth.json');
  }

  async init() {
    await this.loadData();
    setInterval(() => {
      this.flushData();
    }, 500);
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
    this.config = await this._loadJson(this.authPath) || {};
  }

  async loadGoogleAuth(): Promise<GoogleAuth> {
    return this.config.google_auth;
  }

  async saveGoogleAuth(google_auth: GoogleAuth) {
    this.config.google_auth = google_auth;
    this.save_needed = true;
  }

  async flushData(): Promise<void> {
    if (!this.save_needed) {
      return ;
    }

    fs.writeFileSync(this.authPath, JSON.stringify(this.config, null, 2));

    this.save_needed = false;
  }

}
