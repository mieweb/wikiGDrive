'use strict';

import { FileService } from '../utils/FileService';
import * as fs from "fs";

export interface Credentials {

}

export interface GoogleAuth {

}

export interface Config {
  google_auth: GoogleAuth;
  credentials: Credentials;
}

export class ConfigService {
  private save_needed: Boolean = false;
  private fileService: FileService;
  private config: Config;

  constructor(private filePath: string) {
    this.fileService = new FileService();
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

  async _loadJson(filePath) {
    try {
      const content = await this.fileService.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  async loadData() {
    this.config = await this._loadJson(this.filePath) || {};
  }

  async loadCredentials(): Promise<Credentials> {
    return this.config.credentials;
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

    fs.writeFileSync(this.filePath,  JSON.stringify(this.config, null, 2));

    this.save_needed = false;
  }

}
