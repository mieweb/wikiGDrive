'use strict';

import path from 'path';
import fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';
import {StringWritable} from '../utils/StringWritable';
import {GoogleDocsService} from '../google/GoogleDocsService';

export class DownloadPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    this.googleDocsService = new GoogleDocsService();

    eventBus.on('main:init', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('files_structure:dirty', async () => {
      await this.handleDirtyFiles();
    });
    eventBus.on('download:retry', async () => {
      await this.handleDirtyFiles();
    });
    eventBus.on('google_api:initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
  }

  async downloadAssets(files) {
    files = files.filter(file => file.size !== undefined);

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        const targetPath = path.join(this.dest, file.localPath);
        await this.downloadAsset(file, targetPath);
      }));
    }

    await Promise.all(promises);
  }

  async downloadAsset(file, targetPath) {
    console.log('Downloading asset: ' + file.localPath);
    await this.ensureDir(targetPath);

    try {
      const dest = fs.createWriteStream(targetPath);
      await this.googleDriveService.download(this.auth, file, dest);
    } catch (err) {
      fs.unlinkSync(targetPath);
      throw err;
    }

    await this.filesStructure.markClean([ file ]);
  }

  async downloadDiagrams(files) {
    files = files.filter(file => file.mimeType === FilesStructure.DRAWING_MIME);

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        const targetPath = path.join(this.dest, file.localPath);
        await this.downloadDiagram(file, targetPath);
      }));
    }

    await Promise.all(promises);
  }

  async downloadDiagram(file, targetPath) {
    console.log('Downloading diagram: ' + file.localPath);
    await this.ensureDir(targetPath);

    // const svgTransform = new SvgTransform(this.linkTranslator, file.localPath);

    try {
      const writeStream = fs.createWriteStream(targetPath);
      await this.googleDriveService.exportDocument(
        this.auth,
        Object.assign({}, file, { mimeType: 'image/svg+xml' }),
        writeStream);
      // [svgTransform, writeStream]);
    } catch (err) {
      fs.unlinkSync(targetPath);
      throw err;
    }

    try {
      const writeStreamPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

      await this.googleDriveService.exportDocument(
        this.auth,
        Object.assign({}, file, { mimeType: 'image/png' }),
        writeStreamPng);
    } catch (err) {
      fs.unlinkSync(targetPath);
      fs.unlinkSync(targetPath.replace(/.svg$/, '.png'));
      throw err;
    }

    const fileService = new FileService();
    const md5Checksum = await fileService.md5File(targetPath.replace(/.svg$/, '.png'));

    await this.externalFiles.putFile({
      localPath: file.localPath.replace(/.svg$/, '.png'),
      localDocumentPath: file.localPath,
      md5Checksum: md5Checksum
    });
    await this.filesStructure.markClean([ file ]);
  }

  async downloadDocuments(files) {
    files = files.filter(file => file.mimeType === FilesStructure.DOCUMENT_MIME);

/* MOVED TO TRANSFORM
    const navigationFile = files.find(file => file.name === '.navigation');

    const navigationTransform = new NavigationTransform(files, this.link_mode);

    if (navigationFile) {
      const markDownTransform = new MarkDownTransform('.navigation', this.linkTranslator);
      await this.googleDocsService.download(this.auth, navigationFile, [markDownTransform, navigationTransform], this.linkTranslator);
    }
*/

    const promises = [];

    for (const file of files) {
      promises.push(this.jobsQueue.pushJob(async () => {
        const targetPath = path.join(this.dest, file.localPath);
        await this.downloadDocument(file, targetPath);
      }));
    }

    await Promise.all(promises);

    // TODO trigger transform event
  }

  async downloadDocument(file, targetPath) {
    console.log('Downloading document: ' + file.id + '.gdoc [' + file.localPath + ']');
    await this.ensureDir(targetPath);

    const htmlPath = path.join(this.config_dir, 'files', file.id + '.html');
    const gdocPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

    try {
      const destHtml = new StringWritable();
      await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType: 'text/html' }, destHtml);
      fs.writeFileSync(htmlPath, destHtml.getString());

      const destJson = new StringWritable();
      await this.googleDocsService.download(this.auth, file, destJson);
      fs.writeFileSync(gdocPath, destJson.getString());
    } catch (err) {
      fs.unlinkSync(htmlPath);
      fs.unlinkSync(gdocPath);
      throw err;
    }

    await this.filesStructure.markClean([ file ]);
  }

  async handleDirtyFiles() {
    if (!fs.existsSync(path.join(this.config_dir, 'files'))) {
      fs.mkdirSync(path.join(this.config_dir, 'files'), { recursive: true });
    }

    const promises = [];
    const dirtyFiles = this.filesStructure.findFiles(item => !!item.dirty);

    if (dirtyFiles.length > 0) {
      console.log('Downloading modified files (' + dirtyFiles.length + ')');
    }

    for (const file of dirtyFiles) {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

      if (file.mimeType === FilesStructure.DRAWING_MIME) {
        promises.push(this.downloadDiagram(file, targetPath));
      } else
      if (file.mimeType === FilesStructure.DOCUMENT_MIME) {
        promises.push(this.downloadDocument(file, targetPath));
      } else
      if (file.size !== undefined) {
        promises.push(this.downloadAsset(file, targetPath));
      }
    }

    try {
      await Promise.all(promises);
    } catch (ignore) { /* eslint-disable-line no-empty */
    }

    const dirtyFilesAfter = this.filesStructure.findFiles(item => !!item.dirty);
    if (dirtyFilesAfter.length > 0) {
      console.log('Download retry required');
      process.nextTick(() => {
        this.eventBus.emit('download:retry');
      });
    } else {
      this.eventBus.emit('download:clean');
    }

    // async downloadAssets(files) {
    //   files = files.filter(file => file.size !== undefined);
    // async downloadDiagrams(files) {
    //   files = files.filter(file => file.mimeType === FilesStructure.DRAWING_MIME);
    // async downloadDocuments(files) {
    //   files = files.filter(file => file.mimeType === FilesStructure.DOCUMENT_MIME);

/*    const mergedFiles = this.filesStructure.findFiles(item => !!item.dirty);

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

    await this.generateMetaFiles();*/
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
