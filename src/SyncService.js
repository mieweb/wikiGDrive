'use strict';

import path from 'path';
import fs from 'fs';

import {ConfigService} from "./ConfigService";
import {GoogleDriveService} from "./GoogleDriveService";
import {GoogleAuthService} from "./GoogleAuthService";
import {GoogleDocsService} from "./GoogleDocsService";
import {LinkTransform} from "./LinkTransform";

export class SyncService {

  constructor(params) {
    this.params = params;
    this.configService = new ConfigService(this.params.config);
    this.googleAuthService = new GoogleAuthService(this.configService);
    this.googleDriveService = new GoogleDriveService();
    this.googleDocsService = new GoogleDocsService();
  }


  async start() {
    const config = await this.configService.loadConfig();
    const fileMap = config.fileMap || {};

    const auth = await this.googleAuthService.authorize(config.credentials.client_id, config.credentials.client_secret);
    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);
    const files = await this.googleDriveService.listFilesRecursive(auth, folderId);

    files.forEach(file => {
      fileMap[file.id] = file;
    });

    await this.createFolderStructure(files);
    await this.downloadAssets(auth, files);
    await this.downloadDiagrams(auth, files, fileMap);
    await this.downloadDocuments(auth, files, fileMap);

    config.fileMap = fileMap;

    await this.configService.saveConfig(config);
  }

  async downloadAssets(auth, files) {
    files = files.filter(file => file.size !== undefined);

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      await this.googleDriveService.download(auth, file, dest);
    }
  }

  async downloadDiagrams(auth, files, fileMap) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.drawing');

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);
      const linkTransform = new LinkTransform({
        fileMap
      });

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, {mimeType: 'image/svg+xml'}),
        [linkTransform, dest]);
    }

  }

  async downloadDocuments(auth, files, fileMap) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      await this.googleDocsService.download(auth, file, dest, fileMap);
    }
  }

  createFolderStructure(files) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');

    files.sort((a, b) => {
        return a.localPath.length - b.localPath.length;
      });

    files.forEach(file => {
      const targetPath = path.join(this.params.dest, file.localPath);
      fs.mkdirSync(targetPath, { recursive: true });
    })
  }

}
