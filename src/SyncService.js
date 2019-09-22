'use strict';

import path from 'path';
import fs from 'fs';

import {ConfigService} from './ConfigService';
import {GoogleDriveService} from './GoogleDriveService';
import {GoogleAuthService} from './GoogleAuthService';
import {GoogleDocsService} from './GoogleDocsService';
import {LinkTransform} from './LinkTransform';
import {LinkTranslator} from './LinkTranslator';
import {HttpClient} from './HttpClient';
import {FileService} from './FileService';
import {TocGenerator} from './TocGenerator';
import {MarkDownTransform} from './MarkDownTransform';
import {FrontMatterTransform} from './FrontMatterTransform';
import {FilesStructure} from './FilesStructure';

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
    config = await this.configService.loadConfig(); // eslint-disable-line require-atomic-updates

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const filesStructure = new FilesStructure(config.fileMap);

    const changedFiles = await this.googleDriveService.listFilesRecursive(auth, folderId);
    const mergedFiles = filesStructure.merge(changedFiles);

    const httpClient = new HttpClient();
    const linkTranslator = new LinkTranslator(fileMap, httpClient, binaryFiles, this.params.dest);

    await this.createFolderStructure(mergedFiles);
    await this.downloadAssets(auth, mergedFiles);
    await this.downloadDiagrams(auth, mergedFiles, fileMap, binaryFiles);
    await this.downloadDocuments(auth, mergedFiles, linkTranslator);

    const tocGenerator = new TocGenerator(linkTranslator);
    await tocGenerator.generate(fileMap, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

    config.fileMap = filesStructure.fileMap; // eslint-disable-line require-atomic-updates
    config.binaryFiles = binaryFiles; // eslint-disable-line require-atomic-updates
    await this.configService.saveConfig(config);

    if (this.params.watch) {
      console.log('Watching for changes');
      let lastMTime = getMaxModifiedTime(fileMap);
      await new Promise(() => setInterval(async () => {
        const changedFiles = await this.googleDriveService.listFilesRecursive(auth, folderId, lastMTime);
        if (changedFiles.length > 0) {
          console.log(changedFiles.length + ' files modified');

          const mergedFiles = filesStructure.merge(changedFiles);

          await this.createFolderStructure(mergedFiles);
          await this.downloadAssets(auth, mergedFiles);
          await this.downloadDiagrams(auth, mergedFiles, fileMap, binaryFiles);
          await this.downloadDocuments(auth, mergedFiles, linkTranslator);

          const tocGenerator = new TocGenerator(linkTranslator);
          await tocGenerator.generate(fileMap, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

          config.fileMap = filesStructure.fileMap; // eslint-disable-line require-atomic-updates
          config.binaryFiles = binaryFiles; // eslint-disable-line require-atomic-updates
          await this.configService.saveConfig(config);
          console.log('Pulled latest changes');
          lastMTime = getMaxModifiedTime(fileMap); // eslint-disable-line require-atomic-updates
        } else {
          console.log('No changes detected. Sleeping for 10 seconds.');
        }
      }, 10000));
    }
  }

  async downloadAssets(auth, files) {
    files = files.filter(file => file.size !== undefined);

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      await this.googleDriveService.download(auth, file, dest);
    }
  }

  async downloadDiagrams(auth, files, fileMap, binaryFiles) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.drawing');

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const writeStream = fs.createWriteStream(targetPath);

      const httpClient = new HttpClient();
      const linkTranslator = new LinkTranslator(fileMap, httpClient, binaryFiles, this.params.dest);
      const linkTransform = new LinkTransform(linkTranslator, file.localPath);

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, { mimeType: 'image/svg+xml' }),
        [linkTransform, writeStream]);

      const writeStreamPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, { mimeType: 'image/png' }),
        writeStreamPng);

      const fileService = new FileService();
      const md5checksum = await fileService.md5File(targetPath.replace(/.svg$/, '.png'));

      binaryFiles[md5checksum] = { // eslint-disable-line require-atomic-updates
        localPath: file.localPath.replace(/.svg$/, '.png'),
        localDocumentPath: file.localPath,
        md5checksum: md5checksum
      };

    }

  }

  async downloadDocuments(auth, files, linkTranslator) {
    files = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      const markDownTransform = new MarkDownTransform(file.localPath, linkTranslator);
      const frontMatterTransform = new FrontMatterTransform(file);

      await this.googleDocsService.download(auth, file,
        [markDownTransform, frontMatterTransform, dest], linkTranslator);
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

    fs.mkdirSync(path.join(this.params.dest, 'external_files'), { recursive: true });
  }

}
