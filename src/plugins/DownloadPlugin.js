'use strict';

import path from 'path';
import fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {SvgTransform} from '../SvgTransform';
import {FileService} from '../utils/FileService';
import {NavigationTransform} from '../NavigationTransform';
import {MarkDownTransform} from '../markdown/MarkDownTransform';
import {StringWritable} from '../utils/StringWritable';
import {FrontMatterTransform} from '../markdown/FrontMatterTransform';
import {GoogleListFixer} from '../html/GoogleListFixer';
import {EmbedImageFixed} from '../html/EmbedImageFixed';
import {GoogleDocsService} from '../google/GoogleDocsService';

export class DownloadPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    this.googleDocsService = new GoogleDocsService();

    eventBus.on('files_initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('file_structure_changed', async () => {
      await this.handleChangedFiles();
    });
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
