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
    eventBus.on('google_api:initialized', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('files_structure:dirty', async () => {
      await this.handleDirtyFiles();
    });
    eventBus.on('download:process', async () => {
      await this.handleDirtyFiles();
    });
    eventBus.on('download:retry', async () => {
      await this.handleDirtyFiles();
    });
  }

  async downloadAsset(file, targetPath) {
    console.log('Downloading asset: ' + file.localPath);
    await this.ensureDir(targetPath);

    try {
      const dest = fs.createWriteStream(targetPath);
      await this.googleDriveService.download(this.auth, file, dest);
    } catch (err) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      throw err;
    }

    await this.filesStructure.markClean([ file ]);
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
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      throw err;
    }

    try {
      const writeStreamPng = fs.createWriteStream(targetPath.replace(/.svg$/, '.png'));

      await this.googleDriveService.exportDocument(
        this.auth,
        Object.assign({}, file, { mimeType: 'image/png' }),
        writeStreamPng);
    } catch (err) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      if (fs.existsSync(targetPath.replace(/.svg$/, '.png'))) fs.unlinkSync(targetPath.replace(/.svg$/, '.png'));
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
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      if (fs.existsSync(gdocPath)) fs.unlinkSync(gdocPath);
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
