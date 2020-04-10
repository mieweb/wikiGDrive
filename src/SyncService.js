'use strict';

import path from 'path';
import fs from 'fs';

import { ConfigService } from './storage/ConfigService';
import { GoogleDriveService } from './google/GoogleDriveService';
import { GoogleAuthService } from './google/GoogleAuthService';
import { GoogleDocsService } from './google/GoogleDocsService';
import { SvgTransform } from './SvgTransform';
import { LinkTranslator } from './LinkTranslator';
import { HttpClient } from './utils/HttpClient';
import { FileService } from './utils/FileService';
import { TocGenerator } from './TocGenerator';
import { MarkDownTransform } from './markdown/MarkDownTransform';
import { FrontMatterTransform } from './markdown/FrontMatterTransform';
import { FilesStructure } from './storage/FilesStructure';
import { ExternalFiles } from './ExternalFiles';
import { NavigationTransform } from './NavigationTransform';
import { StringWritable } from './utils/StringWritable';
import { GoogleListFixer } from './html/GoogleListFixer';
import { EmbedImageFixed } from './html/EmbedImageFixed';

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
    const configCredentials = await this.configService.loadCredentials();

    if (configCredentials) {
      if (!this.params.client_id) this.params.client_id = configCredentials.client_id;
      if (!this.params.client_secret) this.params.client_secret = configCredentials.client_secret;
    }

    let auth;
    if (this.params.service_account) {
      auth = await this.googleAuthService.authorizeServiceAccount(this.params.service_account);
    } else {
      auth = await this.googleAuthService.authorize(this.params.client_id, this.params.client_secret);
    }

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const context = { folderId: folderId };
    if (this.params.drive_id) {
      context.driveId = this.params.drive_id;
    }

    const fileMap = await this.configService.loadFileMap();
    const binaryFiles = await this.configService.loadBinaryFiles();
    const filesStructure = new FilesStructure(fileMap);

    const changedFiles = await this.googleDriveService.listFilesRecursive(auth, context);
    const mergedFiles = filesStructure.merge(changedFiles);

    const externalFiles = new ExternalFiles(binaryFiles || {}, new HttpClient(), this.params.dest);
    const linkTranslator = new LinkTranslator(filesStructure, externalFiles);
    if (this.params['link_mode']) {
      linkTranslator.mode = this.params['link_mode'];
    }

    let startTrackToken = null;
    if (this.params.watch) {
      startTrackToken = await this.googleDriveService.getStartTrackToken(auth);
      console.log('startTrackToken', startTrackToken);
    }

    await this.createFolderStructure(mergedFiles);
    await this.downloadAssets(auth, mergedFiles);
    await this.downloadDiagrams(auth, mergedFiles, linkTranslator, externalFiles);
    await this.downloadDocuments(auth, mergedFiles, linkTranslator);
    await this.generateConflicts(filesStructure, linkTranslator);
    await this.generateRedirects(filesStructure, linkTranslator);

    const tocGenerator = new TocGenerator('toc.md', linkTranslator);
    await tocGenerator.generate(filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');

    await this.configService.saveFileMap(filesStructure.getFileMap());
    await this.configService.saveBinaryFiles(externalFiles.getBinaryFiles());

    if (this.params.watch) {
      console.log('Watching changes');

      await new Promise(() => setInterval(async () => {
        try {
          const result = await this.googleDriveService.watchChanges(auth, startTrackToken);

          const changedFiles = result.files.filter(file => {
            let retVal = false;
            file.parents.forEach((parentId) => {
              if (filesStructure.containsFile(parentId)) {
                retVal = true;
              }
            });
            return retVal;
          });

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

            await this.configService.saveFileMap(filesStructure.getFileMap());
            await this.configService.saveBinaryFiles(externalFiles.getBinaryFiles());
            console.log('Pulled latest changes');
          } else {
            console.log('No changes detected. Sleeping for 10 seconds.');
          }

          startTrackToken = result.token; // eslint-disable-line require-atomic-updates
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
    }

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];

      console.log('Downloading: ' + file.localPath);

      const targetPath = path.join(this.params.dest, file.localPath);
      const dest = fs.createWriteStream(targetPath);

      const markDownTransform = new MarkDownTransform(file.localPath, linkTranslator);
      const frontMatterTransform = new FrontMatterTransform(file, linkTranslator, navigationTransform.hierarchy);

      const destHtml = new StringWritable();
      await this.googleDriveService.exportDocument(auth, { id: file.id, mimeType: 'text/html' }, destHtml);

      const googleListFixer = new GoogleListFixer(destHtml.getString());
      const embedImageFixed = new EmbedImageFixed(destHtml.getString());

      await this.googleDocsService.download(auth, file,
        [googleListFixer, embedImageFixed, markDownTransform, frontMatterTransform, dest], linkTranslator);

      if (this.params.debug) {
        fs.writeFileSync(path.join(this.params.dest, file.localPath + '.html'), destHtml.getString());

        const destJson = fs.createWriteStream(path.join(this.params.dest, file.localPath + '.json'));
        await this.googleDocsService.download(auth, file,
          [destJson], linkTranslator);
      }
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
