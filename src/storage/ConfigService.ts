'use strict';

import * as path from 'path';
import {FileContentService} from '../utils/FileContentService';

export interface GoogleAuth {
  refresh_token?: string | null;
  expiry_date?: number | null;
  access_token?: string | null;
  token_type?: string | null;
  id_token?: string | null;
  scope?: string;
}

export interface Config {
  google_auth: GoogleAuth;
}

export class ConfigService {
  private save_needed = false;
  private fileService: FileContentService;
  private config: Config;
  private readonly authPath: string;

  constructor(private config_dir: string) {
    this.fileService = new FileContentService();
    this.authPath = path.join(config_dir, 'google_auth.json');
  }

  async init() {
    await this.loadData();
    setInterval(() => {
      this.flushData();
    }, 500);
  }

  async loadData() {
    this.config = await this.fileService.readJson(this.authPath) || {};
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

    await this.fileService.writeJson(this.authPath, this.config);

    this.save_needed = false;
  }

}
