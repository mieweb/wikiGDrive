/* eslint-disable no-async-promise-executor */
'use strict';

import path from 'path';
import fs from 'fs';

import {ConfigService} from './storage/ConfigService';
import {GoogleDriveService} from './google/GoogleDriveService';
import {GoogleAuthService} from './google/GoogleAuthService';
import {GoogleDocsService} from './google/GoogleDocsService';
import {SvgTransform} from './SvgTransform';
import {LinkTranslator} from './LinkTranslator';
import {HttpClient} from './utils/HttpClient';
import {FileService} from './utils/FileService';
import {TocGenerator} from './TocGenerator';
import {MarkDownTransform} from './markdown/MarkDownTransform';
import {FrontMatterTransform} from './markdown/FrontMatterTransform';
import {FilesStructure} from './storage/FilesStructure';
import {ExternalFiles} from './ExternalFiles';
import {NavigationTransform} from './NavigationTransform';
import {StringWritable} from './utils/StringWritable';
import {GoogleListFixer} from './html/GoogleListFixer';
import {EmbedImageFixed} from './html/EmbedImageFixed';
import {JobsPool} from './jobs/JobsPool';
import {JobsQueue} from './jobs/JobsQueue';
import {QuotaLimiter} from './google/QuotaLimiter';

export class SyncService {

  constructor(params) {
    this.params = params;
    this.configService = new ConfigService(this.params.config);

    const quotaLimiter = new QuotaLimiter(9500, 100);
    // const quotaLimiter = new QuotaLimiter(1, 5);

    this.googleAuthService = new GoogleAuthService(this.configService, quotaLimiter);
    this.googleDriveService = new GoogleDriveService(this.params);
    this.googleDocsService = new GoogleDocsService();
    this.filesStructure = new FilesStructure(this.configService);
    this.externalFiles = new ExternalFiles(this.configService, new HttpClient(), this.params.dest);

    this.jobsQueue = new JobsQueue();
    this.jobsPool = new JobsPool(20, this.jobsQueue);
  }

  async start() {
    await this.configService.resetConfig(this.params['config-reset']);

    await this.filesStructure.init();
    await this.externalFiles.init();

    this.linkTranslator = new LinkTranslator(this.filesStructure, this.externalFiles);
    if (this.params['link_mode']) {
      this.linkTranslator.mode = this.params['link_mode'];
    }

    const configCredentials = await this.configService.loadCredentials();
    if (configCredentials) {
      if (!this.params.client_id) this.params.client_id = configCredentials.client_id;
      if (!this.params.client_secret) this.params.client_secret = configCredentials.client_secret;
    }

    if (this.params.service_account) {
      this.auth = await this.googleAuthService.authorizeServiceAccount(this.params.service_account);
    } else {
      this.auth = await this.googleAuthService.authorize(this.params.client_id, this.params.client_secret);
    }

    const folderId = this.googleDriveService.urlToFolderId(this.params['drive']);

    const context = { folderId: folderId };
    if (this.params.drive_id) {
      context.driveId = this.params.drive_id;
    }

    let lastMTime = this.filesStructure.getMaxModifiedTime();
    if (!this.params.watch) {
      const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
      await this.saveChangedFiles(changedFiles);
      await this.handleChangedFiles();

    } else if (this.params.watch === 'mtime') {
      console.log('Watching changes with mtime');

      while (true) { // eslint-disable-line no-constant-condition
        try {
          let lastMTime = this.filesStructure.getMaxModifiedTime();
          const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
          await this.saveChangedFiles(changedFiles);
          await this.handleChangedFiles();

          console.log('Sleeping for 10 seconds.');

          await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        } catch (e) {
          console.error(e);
        }
      }

    } else {
      let startTrackToken = await this.googleDriveService.getStartTrackToken(this.auth);
      console.log('startTrackToken', startTrackToken);

      const changedFiles = await this.googleDriveService.listRootRecursive(this.auth, context, lastMTime);
      await this.saveChangedFiles(changedFiles);
      await this.handleChangedFiles();

      console.log('Watching changes');

      await new Promise(() => setInterval(async () => {
        try {
          const result = await this.googleDriveService.watchChanges(this.auth, startTrackToken, this.params.drive_id);

          const changedFiles = result.files.filter(file => {
            let retVal = false;
            file.parents.forEach((parentId) => {
              if (this.filesStructure.containsFile(parentId)) {
                retVal = true;
              }
            });
            return retVal;
          });

          if (changedFiles.length > 0) {
            console.log(changedFiles.length + ' files modified');
            await this.saveChangedFiles(changedFiles);
            console.log('Pulled latest changes');
          } else {
            console.log('No changes detected. Sleeping for 10 seconds.');
          }

          await this.handleChangedFiles();

          startTrackToken = result.token; // eslint-disable-line require-atomic-updates
        } catch (e) {
          console.error(e);
        }
      }, 10000));

    }

    await new Promise(async (resolve, reject) => {
      setTimeout(reject, 3600 * 1000);
      await this.configService.flush();
      resolve();
    });
  }

  async downloadAssets(files) {
    files = files.filter(file => file.size !== undefined);

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        console.log('Downloading asset: ' + file.localPath);

        const targetPath = path.join(this.params.dest, file.localPath);
        await this.ensureDir(targetPath);
        const dest = fs.createWriteStream(targetPath);

        await this.googleDriveService.download(this.auth, file, dest);
        await this.filesStructure.markClean([ file ]);
      }));
    }

    await Promise.all(promises);
  }

  async downloadDiagrams(files) {
    files = files.filter(file => file.mimeType === FilesStructure.DRAWING_MIME);

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        console.log('Downloading diagram: ' + file.localPath);

        const targetPath = path.join(this.params.dest, file.localPath);
        await this.ensureDir(targetPath);
        const writeStream = fs.createWriteStream(targetPath);

        const svgTransform = new SvgTransform(this.linkTranslator, file.localPath);

        await this.googleDriveService.exportDocument(
          this.auth,
          Object.assign({}, file, { mimeType: 'image/svg+xml' }),
          [svgTransform, writeStream]);

        const writeStreamPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

        await this.googleDriveService.exportDocument(
          this.auth,
          Object.assign({}, file, { mimeType: 'image/png' }),
          writeStreamPng);

        const fileService = new FileService();
        const md5Checksum = await fileService.md5File(targetPath.replace(/.svg$/, '.png'));

        await this.externalFiles.putFile({
          localPath: file.localPath.replace(/.svg$/, '.png'),
          localDocumentPath: file.localPath,
          md5Checksum: md5Checksum
        });
        await this.filesStructure.markClean([ file ]);
      }));
    }

    await Promise.all(promises);
  }

  async downloadDocuments(files) {
    files = files.filter(file => file.mimeType === FilesStructure.DOCUMENT_MIME);

    const navigationFile = files.find(file => file.name === '.navigation');

    const navigationTransform = new NavigationTransform(files, this.params['link_mode']);

    if (navigationFile) {
      const markDownTransform = new MarkDownTransform('.navigation', this.linkTranslator);
      await this.googleDocsService.download(this.auth, navigationFile, [markDownTransform, navigationTransform], this.linkTranslator);
    }

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        console.log('Downloading document: ' + file.localPath);

        const targetPath = path.join(this.params.dest, file.localPath);
        await this.ensureDir(targetPath);

        const destHtml = new StringWritable();
        await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType: 'text/html' }, destHtml);

        fs.writeFileSync(path.join(this.params.dest, file.localPath + '.html'), destHtml.getString());

        const gdocPath = path.join(this.params.dest, file.localPath + '.gdoc');
        const destJson = fs.createWriteStream(gdocPath);
        await this.googleDocsService.download(this.auth, file, destJson);

        // TODO extract to transform queue

        const dest = fs.createWriteStream(targetPath);

        const markDownTransform = new MarkDownTransform(file.localPath, this.linkTranslator);
        const frontMatterTransform = new FrontMatterTransform(file, this.linkTranslator, navigationTransform.hierarchy);
        const googleListFixer = new GoogleListFixer(destHtml.getString());
        const embedImageFixed = new EmbedImageFixed(destHtml.getString());

        const stream = fs.createReadStream(gdocPath)
          .pipe(googleListFixer)
          .pipe(embedImageFixed)
          .pipe(markDownTransform)
          .pipe(frontMatterTransform)
          .pipe(dest);

        await new Promise((resolve, reject) => {
          stream.on('finish', () => {
            resolve();
          });
          stream.on('error', err => {
            reject(err);
          });
        });

        // await this.googleDocsService.download(this.auth, file,
        //   [googleListFixer, embedImageFixed, markDownTransform, frontMatterTransform, dest]);

        await this.filesStructure.markClean([ file ]);
      }));
    }

    await Promise.all(promises);
  }

  createFolderStructure(allFiles) {
    let directories = allFiles.filter(file => file.mimeType === FilesStructure.FOLDER_MIME);

    if (this.params['flat-folder-structure']) {
      directories = directories.filter(dir => {
        return !!allFiles.find(file => file.mimeType !== FilesStructure.FOLDER_MIME && file.desiredLocalPath.startsWith(dir.desiredLocalPath));
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

  async generateConflicts() {
    const filesMap = this.filesStructure.getFileMap();
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.CONFLICT_MIME);

    for (const file of files) {
      const targetPath = path.join(this.params.dest, file.localPath);
      await this.ensureDir(targetPath);
      const dest = fs.createWriteStream(targetPath);

      let md = '';
      md += 'There were two documents with the same name in the same folder:\n';
      md += '\n';
      for (const id of file.conflicting) {
        const conflictingFile = filesMap[id];

        const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(conflictingFile.localPath, file.localPath);
        md += '* [' + conflictingFile.name + '](' + relativePath + ')\n';
      }

      dest.write(md);
      dest.close();
    }
  }

  async generateRedirects() {
    const filesMap = this.filesStructure.getFileMap();
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.REDIRECT_MIME);

    for (const file of files) {
      const targetPath = path.join(this.params.dest, file.localPath);
      await this.ensureDir(targetPath);
      const dest = fs.createWriteStream(targetPath);

      const newFile = filesMap[file.redirectTo];

      let md = '';
      md += 'Renamed to: ';
      const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(newFile.localPath, file.localPath);
      md += '[' + newFile.name + '](' + relativePath + ')\n';

      dest.write(md);
      dest.close();
    }
  }

  async generateMetaFiles() {
    await this.generateConflicts();
    await this.generateRedirects();
    const tocGenerator = new TocGenerator('toc.md', this.linkTranslator);
    await tocGenerator.generate(this.filesStructure, fs.createWriteStream(path.join(this.params.dest, 'toc.md')), '/toc.html');
  }

  async saveChangedFiles(changedFiles) {
    await this.filesStructure.merge(changedFiles);
  }

  async handleChangedFiles() {
    await this.scanFileSystem();
    const mergedFiles = this.filesStructure.findFiles(item => !!item.dirty);

    await this.createFolderStructure(mergedFiles);
    await this.downloadAssets(mergedFiles);
    await this.downloadDiagrams(mergedFiles);
    await this.downloadDocuments(mergedFiles);

    if (this.jobsQueue.size() > 0) {
      await new Promise((resolve, reject) => {
        setTimeout(() => reject, 60 * 1000);
        this.jobsQueue.once('empty', resolve);
      });
    }

    await this.generateMetaFiles();
  }

  async scanFileSystem() {
    const files = this.filesStructure.findFiles(item => !item.dirty);
    const fileService = new FileService();

    for (const file of files) {
      console.log('sss', this.params.dest, file.localPath, file.id);
      const targetPath = path.join(this.params.dest, file.localPath);

      if (!await fileService.exists(targetPath)) {
        await this.filesStructure.markDirty([file]);
      }
    }

    await this.externalFiles.cleanup();
  }

  async ensureDir(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length < 2) {
      return;
    }
    parts.pop();

    fs.mkdirSync(parts.join(path.sep), { recursive: true });
  }

}
