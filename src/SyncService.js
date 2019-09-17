'use strict';

import path from 'path';
import fs from 'fs';

import {ConfigService} from "./ConfigService";
import {GoogleDriveService} from "./GoogleDriveService";
import {GoogleAuthService} from "./GoogleAuthService";
import {GoogleDocsService} from "./GoogleDocsService";
import {LinkTransform} from "./LinkTransform";
import {LinkTranslator} from "./LinkTranslator";
import {HttpClient} from "./HttpClient";
import {FileService} from "./FileService";

function getMaxModifiedTime(fileMap) {
  let maxModifiedTime = null;

  for (let fileId in fileMap) {
    const file = fileMap[fileId];
    if (!maxModifiedTime) {
      maxModifiedTime = file.modifiedTime;
      continue;
    }

    if (maxModifiedTime < file.modifiedTime) {
      maxModifiedTime = file.modifiedTime;
    }
  }

  return maxModifiedTime;
}


export class SyncService {

  constructor(params) {
    this.params = params;
    this.configService = new ConfigService(this.params.config);
    this.googleAuthService = new GoogleAuthService(this.configService);
    this.googleDriveService = new GoogleDriveService();
    this.googleDocsService = new GoogleDocsService();
  }


  async start() {
    let config = await this.configService.loadConfig();
    const fileMap = config.fileMap || {};
    const binaryFiles = config.binaryFiles || {};

    if (config.credentials) {
      if (!this.params.client_id) this.params.client_id = config.credentials.client_id;
      if (!this.params.client_secret) this.params.client_secret = config.credentials.client_secret;
    }

    const auth = await this.googleAuthService.authorize(this.params.client_id, this.params.client_secret);
    config = await this.configService.loadConfig();

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const files = await this.googleDriveService.listFilesRecursive(auth, folderId);
    files.forEach(file => {
      fileMap[file.id] = file;
    });

    const httpClient = new HttpClient();
    const linkTranslator = new LinkTranslator(fileMap, httpClient, binaryFiles, this.params.dest);

    await this.createFolderStructure(files);
    await this.downloadAssets(auth, files);
    await this.downloadDiagrams(auth, files, fileMap, binaryFiles);
    await this.downloadDocuments(auth, files, linkTranslator);

    config.binaryFiles = binaryFiles;
    config.fileMap = fileMap;
    await this.configService.saveConfig(config);

    if (this.params.watch) {
      console.log('Watching for changes');
      while (true) {
        const stop = new Date().getTime();
        while(new Date().getTime() < stop + 2000) {}

        let lastMTime = getMaxModifiedTime(fileMap);

        const files = await this.googleDriveService.listFilesRecursive(auth, folderId, lastMTime);
        if (files.length > 0) {
          console.log(files.length + " files modified");
          files.forEach(file => {
            fileMap[file.id] = file;
          });

          await this.createFolderStructure(files);
          await this.downloadAssets(auth, files);
          await this.downloadDiagrams(auth, files, fileMap, binaryFiles);
          await this.downloadDocuments(auth, files, linkTranslator);

          config.binaryFiles = binaryFiles;
          config.fileMap = fileMap;
          await this.configService.saveConfig(config);
        }
      }
    }

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

  async downloadDiagrams(auth, files, fileMap, binaryFiles) {
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

      const destPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, {mimeType: 'image/png'}),
        destPng);


      const fileService = new FileService();
      const md5checksum = await fileService.md5File(targetPath.replace(/.svg$/, '.png'));

      binaryFiles[md5checksum] = {
        localPath: targetPath.replace(/.svg$/, '.png'),
        localDocumentPath: targetPath,
        md5checksum: md5checksum
      };
    }

  }

  async downloadDocuments(auth, files, linkTranslator) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      await this.googleDocsService.download(auth, file, dest, linkTranslator);
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
    });

    fs.mkdirSync(path.join(this.params.dest, '.binary_files'), { recursive: true });
  }

}
