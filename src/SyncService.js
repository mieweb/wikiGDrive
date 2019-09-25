'use strict';

import path from 'path';
import fs from 'fs';

import {ConfigService} from './ConfigService';
import {GoogleDriveService} from './GoogleDriveService';
import {GoogleAuthService} from './GoogleAuthService';
import {GoogleDocsService} from './GoogleDocsService';
import {SvgTransform} from './SvgTransform';
import {LinkTranslator} from './LinkTranslator';
import {HttpClient} from './HttpClient';
import {FileService} from './FileService';
import {TocGenerator} from './TocGenerator';
import {MarkDownTransform} from './MarkDownTransform';
import {FrontMatterTransform} from './FrontMatterTransform';
import {FilesStructure} from './FilesStructure';
import {ExternalFiles} from './ExternalFiles';

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

    if (config.credentials) {
      if (!this.params.client_id) this.params.client_id = config.credentials.client_id;
      if (!this.params.client_secret) this.params.client_secret = config.credentials.client_secret;
    }

    const auth = await this.googleAuthService.authorize(this.params.client_id, this.params.client_secret);
    config = await this.configService.loadConfig(); // eslint-disable-line require-atomic-updates

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const filesStructure = new FilesStructure(config.fileMap);

    const httpClient = new HttpClient();
    const externalFiles = new ExternalFiles(config.binaryFiles || {}, httpClient, this.params.dest);

    const changedFiles = await this.googleDriveService.listFilesRecursive(auth, folderId);
    const mergedFiles = filesStructure.merge(changedFiles);

    const linkTranslator = new LinkTranslator(filesStructure, externalFiles);

    await this.createFolderStructure(mergedFiles);
    await this.downloadAssets(auth, mergedFiles);
    await this.downloadDiagrams(auth, mergedFiles, linkTranslator, externalFiles);
    await this.downloadDocuments(auth, mergedFiles, linkTranslator);
    await this.generateConflicts(filesStructure);
    await this.generateRedirects(filesStructure);

    const tocGenerator = new TocGenerator();
    await tocGenerator.generate(filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

    config.fileMap = filesStructure.getFileMap(); // eslint-disable-line require-atomic-updates
    config.binaryFiles = externalFiles.getBinaryFiles(); // eslint-disable-line require-atomic-updates
    await this.configService.saveConfig(config);

    if (this.params.watch) {
      console.log('Watching for changes');
      let lastMTime = filesStructure.getMaxModifiedTime();
      await new Promise(() => setInterval(async () => {
        const changedFiles = await this.googleDriveService.listFilesRecursive(auth, folderId, lastMTime);
        if (changedFiles.length > 0) {
          console.log(changedFiles.length + ' files modified');

          const mergedFiles = filesStructure.merge(changedFiles);

          await this.createFolderStructure(mergedFiles);
          await this.downloadAssets(auth, mergedFiles);
          await this.downloadDiagrams(auth, mergedFiles, linkTranslator, externalFiles);
          await this.downloadDocuments(auth, mergedFiles, linkTranslator);
          await this.generateConflicts(filesStructure);
          await this.generateRedirects(filesStructure);

          const tocGenerator = new TocGenerator();
          await tocGenerator.generate(filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

          config.fileMap = filesStructure.getFileMap(); // eslint-disable-line require-atomic-updates
          config.binaryFiles = externalFiles.getBinaryFiles(); // eslint-disable-line require-atomic-updates
          await this.configService.saveConfig(config);
          console.log('Pulled latest changes');
          lastMTime = filesStructure.getMaxModifiedTime(); // eslint-disable-line require-atomic-updates
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

  async downloadDiagrams(auth, files, linkTranslator, externalFiles) {
    files = files.filter(file => file.mimeType === FilesStructure.DRAWING_MIME);

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const writeStream = fs.createWriteStream(targetPath);

      const svgTransform = new SvgTransform(linkTranslator, file.localPath);

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, { mimeType: 'image/svg+xml' }),
        [svgTransform, writeStream]);

      const writeStreamPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

      await this.googleDriveService.exportDocument(
        auth,
        Object.assign({}, file, { mimeType: 'image/png' }),
        writeStreamPng);

      const fileService = new FileService();
      const md5Checksum = await fileService.md5File(targetPath.replace(/.svg$/, '.png'));

      externalFiles.putFile({
        localPath: file.localPath.replace(/.svg$/, '.png'),
        localDocumentPath: file.localPath,
        md5Checksum: md5Checksum
      });
    }
  }

  async downloadDocuments(auth, files, linkTranslator) {
    files = files.filter(file => file.mimeType === FilesStructure.DOCUMENT_MIME);

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
    files = files.filter(file => file.mimeType === FilesStructure.FOLDER_MIME);

    files.sort((a, b) => {
      return a.localPath.length - b.localPath.length;
    });

    files.forEach(file => {
      const targetPath = path.join(this.params.dest, file.localPath);
      fs.mkdirSync(targetPath, { recursive: true });
    });

    fs.mkdirSync(path.join(this.params.dest, 'external_files'), { recursive: true });
  }

  async generateConflicts(filesStructure) {
    const filesMap = filesStructure.getFileMap();
    const files = filesStructure.findFiles(file => file.mimeType === FilesStructure.CONFLICT_MIME);

    files.forEach(file => {
      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      let md = '';
      md += 'There were two documents with the same name in the same folder:\n';
      md += '\n';
      for (let fileNo = 0; fileNo < file.conflicting.length; fileNo++) {
        const id = file.conflicting[fileNo];
        const conflictingFile = filesMap[id];
        md += '* [' + conflictingFile.name + '](' + conflictingFile.localPath + ')\n';
      }

      dest.write(md);
      dest.close();
    });
  }

  async generateRedirects(filesStructure) {
    const filesMap = filesStructure.getFileMap();
    const files = filesStructure.findFiles(file => file.mimeType === FilesStructure.REDIRECT_MIME);

    files.forEach(file => {
      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      const newFile = filesMap[file.redirectTo];

      let md = '';
      md += 'Renamed to: ';
      md += '[' + newFile.name + '](' + newFile.localPath + ')\n';

      dest.write(md);
      dest.close();
    });
  }

}
