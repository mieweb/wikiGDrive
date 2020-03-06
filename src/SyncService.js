'use strict';

import path from 'path';
import fs from 'fs';

import { ConfigService } from './ConfigService';
import { GoogleDriveService } from './GoogleDriveService';
import { GoogleAuthService } from './GoogleAuthService';
import { GoogleDocsService } from './GoogleDocsService';
import { SvgTransform } from './SvgTransform';
import { LinkTranslator } from './LinkTranslator';
import { HttpClient } from './HttpClient';
import { FileService } from './FileService';
import { TocGenerator } from './TocGenerator';
import { MarkDownTransform } from './MarkDownTransform';
import { FrontMatterTransform } from './FrontMatterTransform';
import { FilesStructure } from './FilesStructure';
import { ExternalFiles } from './ExternalFiles';
import {NavigationTransform} from './NavigationTransform';
import {GoogleListFixer} from './GoogleListFixer';

export class SyncService {

  constructor(params) {
    this.params = params;
    this.configService = new ConfigService(this.params.config);
    this.googleAuthService = new GoogleAuthService(this.configService);
    this.googleDriveService = new GoogleDriveService(this.params);
    this.googleDocsService = new GoogleDocsService();
  }

  async start() {
    await this.configService.resetConfig(this.params['config-reset']);
    let config = await this.configService.loadConfig();

    if (config.credentials) {
      if (!this.params.client_id) this.params.client_id = config.credentials.client_id;
      if (!this.params.client_secret) this.params.client_secret = config.credentials.client_secret;
    }

    const httpClient = new HttpClient();

    const auth = await this.googleAuthService.authorize(this.params.client_id, this.params.client_secret);
    config = await this.configService.loadConfig(); // eslint-disable-line require-atomic-updates

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const filesStructure = new FilesStructure(config.fileMap);
    const externalFiles = new ExternalFiles(config.binaryFiles || {}, httpClient, this.params.dest);

    const linkTranslator = new LinkTranslator(filesStructure, externalFiles);
    if (this.params['link_mode']) {
      linkTranslator.mode = this.params['link_mode'];
    }

    const initialStartToken = config.startTrackToken;
    let startTrackToken = initialStartToken || null;
    if (this.params.watch) {
      if (!config.startTrackToken) {
        const context = {};
        if (this.params.drive_id) {
          context.drive_id = this.params.drive_id;
        }
        startTrackToken = await this.googleDriveService.getStartTrackToken(auth, context);
      }
      console.log('startTrackToken', startTrackToken);
    }

    if (!this.params.watch || !initialStartToken) {
      const changedFiles = await this.googleDriveService.listFilesRecursive(auth, folderId);
      const mergedFiles = filesStructure.merge(changedFiles);

      await this.createFolderStructure(mergedFiles);
      await this.downloadAssets(auth, mergedFiles);
      await this.downloadDiagrams(auth, mergedFiles, linkTranslator, externalFiles);
      await this.downloadDocuments(auth, mergedFiles, linkTranslator);
      await this.generateConflicts(filesStructure, linkTranslator);
      await this.generateRedirects(filesStructure, linkTranslator);

      const tocGenerator = new TocGenerator('toc.md', linkTranslator);
      await tocGenerator.generate(filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');
    }

    config.fileMap = filesStructure.getFileMap(); // eslint-disable-line require-atomic-updates
    config.binaryFiles = externalFiles.getBinaryFiles(); // eslint-disable-line require-atomic-updates
    config.startTrackToken = startTrackToken; // eslint-disable-line require-atomic-updates

    await this.configService.saveConfig(config);

    if (this.params.watch) {
      console.log('Watching changes');

      await new Promise(() => setInterval(async () => {
        try {
          const result = await this.googleDriveService.watchChanges(auth, startTrackToken);

          const changedFiles = result.files.filter(file => {
            let retVal = false;
            if (file.parents) {
              file.parents.forEach((parentId) => {
                if (folderId === parentId) {
                  retVal = true;
                } else
                if (filesStructure.containsFile(parentId)) {
                  retVal = true;
                }
              });
            }
            return retVal;
          });

          startTrackToken = result.token; // eslint-disable-line require-atomic-updates

          config.startTrackToken = startTrackToken;

          if (changedFiles.length > 0) {
            console.log(changedFiles.length + ' files modified');

            const mergedFiles = filesStructure.merge(changedFiles);

            await this.createFolderStructure(mergedFiles);
            await this.downloadAssets(auth, mergedFiles);
            await this.downloadDiagrams(auth, mergedFiles, linkTranslator, externalFiles);
            await this.downloadDocuments(auth, mergedFiles, linkTranslator);
            await this.generateConflicts(filesStructure, linkTranslator);
            await this.generateRedirects(filesStructure, linkTranslator);

            const tocGenerator = new TocGenerator('toc.md', linkTranslator);
            await tocGenerator.generate(filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

            config.fileMap = filesStructure.getFileMap(); // eslint-disable-line require-atomic-updates
            config.binaryFiles = externalFiles.getBinaryFiles(); // eslint-disable-line require-atomic-updates
            await this.configService.saveConfig(config);
            console.log('Pulled latest changes');
          } else {
            console.log('No changes detected. Sleeping for 10 seconds.');
          }
        } catch (e) {
          console.error(e);
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

    const navigationFile = files.find(file => file.name === '.navigation');

    const navigationTransform = new NavigationTransform(files, this.params['link_mode']);

    if (navigationFile) {
      const markDownTransform = new MarkDownTransform('.navigation', linkTranslator);
      await this.googleDocsService.download(auth, navigationFile, [markDownTransform, navigationTransform], linkTranslator);
    } else {
      const navigationPath = path.join(this.params.dest, '.navigation.md');
      const fileService = new FileService();
      if (await fileService.exists(navigationPath)) {
        const navigationContent = await fileService.readFile(navigationPath);
        navigationTransform.write(navigationContent);
        navigationTransform.end();
      }
    }

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      const markDownTransform = new MarkDownTransform(file.localPath, linkTranslator);
      const frontMatterTransform = new FrontMatterTransform(file, linkTranslator, navigationTransform.hierarchy);

      const destDoc = fs.createWriteStream(path.join(this.params.dest, file.localPath + '.html'));
      await this.googleDriveService.exportDocument(auth, { id: file.id, mimeType: 'text/html' }, destDoc);

      const googleListFixer = new GoogleListFixer(path.join(this.params.dest, file.localPath + '.html'));

      await this.googleDocsService.download(auth, file,
        [googleListFixer, markDownTransform, frontMatterTransform, dest], linkTranslator);

      const destJson = fs.createWriteStream(path.join(this.params.dest, file.localPath + '.json'));

      await this.googleDocsService.download(auth, file,
        [destJson], linkTranslator);
    }
  }

  createFolderStructure(allFiles) {
    let directories = allFiles.filter(file => file.mimeType === FilesStructure.FOLDER_MIME);

    if (this.params['flat-folder-structure']) {
      directories = directories.filter(dir => {
        const found = allFiles.find(file => file.mimeType !== FilesStructure.FOLDER_MIME && file.desiredLocalPath.startsWith(dir.desiredLocalPath));
        return found;
      });
    }

    directories.sort((a, b) => {
      return a.localPath.length - b.localPath.length;
    });

    directories.forEach(directory => {
      const targetPath = path.join(this.params.dest, directory.localPath);
      fs.mkdirSync(targetPath, { recursive: true });
    });

    fs.mkdirSync(path.join(this.params.dest, 'external_files'), { recursive: true });
  }

  async generateConflicts(filesStructure, linkTranslator) {
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

        const relativePath = linkTranslator.convertToRelativeMarkDownPath(conflictingFile.localPath, file.localPath);
        md += '* [' + conflictingFile.name + '](' + relativePath + ')\n';
      }

      dest.write(md);
      dest.close();
    });
  }

  async generateRedirects(filesStructure, linkTranslator) {
    const filesMap = filesStructure.getFileMap();
    const files = filesStructure.findFiles(file => file.mimeType === FilesStructure.REDIRECT_MIME);

    files.forEach(file => {
      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      const newFile = filesMap[file.redirectTo];

      let md = '';
      md += 'Renamed to: ';
      const relativePath = linkTranslator.convertToRelativeMarkDownPath(newFile.localPath, file.localPath);
      md += '[' + newFile.name + '](' + relativePath + ')\n';

      dest.write(md);
      dest.close();
    });
  }

}
