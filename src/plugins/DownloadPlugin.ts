'use strict';

import * as path from 'path';
import * as fs from 'fs';
import {queue} from 'async';

import {BasePlugin} from './BasePlugin';
import {GoogleFile, GoogleFiles} from '../storage/GoogleFiles';
import {FileService} from '../utils/FileService';
import {StringWritable} from '../utils/StringWritable';
import {BufferWritable} from '../utils/BufferWritable';
import {GoogleDocsService} from '../google/GoogleDocsService';
import {GoogleDriveService} from '../google/GoogleDriveService';
import {ExternalFiles} from '../storage/ExternalFiles';
import {CliParams} from '../MainService';

export class DownloadPlugin extends BasePlugin {
  private googleDocsService: GoogleDocsService;
  private config_dir: string;
  private googleFiles: GoogleFiles;
  private auth: any;
  private googleDriveService: GoogleDriveService;
  private externalFiles: ExternalFiles;
  private debug: string[];

  private progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private handlingFiles = false;
  private googleFileIds: string[];

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.googleFileIds = [];

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    this.googleDocsService = new GoogleDocsService(this.logger);

    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });
    eventBus.on('main:run', async (params: CliParams) => {
      this.config_dir = params.config_dir;
      this.debug = params.debug;
    });
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('external_files:initialized', ({ externalFiles }) => {
      this.externalFiles = externalFiles;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('download:run', async () => {
      await this.handleDirtyFiles();
    });
    eventBus.on('download:retry', async () => {
      await this.handleDirtyFiles();
    });
  }

  private async downloadAsset(file, targetPath) {
    this.logger.info('Downloading asset: ' + file.localPath);
    await this.ensureDir(targetPath);

    try {
      const dest = fs.createWriteStream(targetPath);
      await this.googleDriveService.download(this.auth, file, dest);
    } catch (err) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      throw err;
    }

    await this.googleFiles.markClean([ file ]);
  }

  private async downloadDiagram(file, targetPath) {
    const targetPathSvg = targetPath.replace(/.gdoc$/, '.svg');
    const targetPathPng = targetPath.replace(/.gdoc$/, '.png');
    this.logger.info('Downloading diagram: ' + file.localPath);
    await this.ensureDir(targetPathSvg);

    try {
      const writeStream = fs.createWriteStream(targetPathSvg);
      await this.googleDriveService.exportDocument(
        this.auth,
        Object.assign({}, file, { mimeType: 'image/svg+xml' }),
        writeStream);
    } catch (err) {
      if (fs.existsSync(targetPathSvg)) fs.unlinkSync(targetPathSvg);
      throw err;
    }

    try {
      const writeStreamPng = fs.createWriteStream(targetPathPng);

      await this.googleDriveService.exportDocument(
        this.auth,
        Object.assign({}, file, { mimeType: 'image/png' }),
        writeStreamPng);
    } catch (err) {
      if (fs.existsSync(targetPathSvg)) fs.unlinkSync(targetPathSvg);
      if (fs.existsSync(targetPathPng)) fs.unlinkSync(targetPathPng);
      throw err;
    }

    const fileService = new FileService();
    const md5Checksum = await fileService.md5File(targetPath.replace(/.gdoc$/, '.png'));

    await this.externalFiles.putFile({
      localPath: file.localPath.replace(/.svg$/, '.png'),
      localDocumentPath: file.localPath,
      md5Checksum: md5Checksum
    });

    await this.googleFiles.markClean([ file ]);

    return file;
  }

  private async downloadDocument(file) {
    await this.ensureDir(path.join(this.config_dir, 'files', file.id + '.zip'));

    const zipPath = path.join(this.config_dir, 'files', file.id + '.zip');
    const gdocPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

    try {
      const destZip = new BufferWritable();
      const destJson = new StringWritable();

      await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType: 'application/zip', localPath: file.localPath }, destZip);
      await this.googleDocsService.download(this.auth, file, destJson);

      fs.writeFileSync(zipPath, destZip.getBuffer());
      fs.writeFileSync(gdocPath, destJson.getString());
      await this.googleFiles.markClean([ file ]);

      return file;
    } catch (err) {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(gdocPath)) fs.unlinkSync(gdocPath);
      await this.googleFiles.markDirty([ file ]);
      throw err;
    }
  }

  private async exportBinary(file, mimeType, ext) {
    const extPath = path.join(this.config_dir, 'files', file.id + '.' + ext);

    await this.ensureDir(extPath);

    try {
      await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType, localPath: file.localPath }, fs.createWriteStream(extPath));
      await this.googleFiles.markClean([ file ]);
    } catch (err) {
      if (fs.existsSync(extPath)) fs.unlinkSync(extPath);
      await this.googleFiles.markDirty([ file ]);
      throw err;
    }
  }

  private async handleDirtyFiles() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    if (!fs.existsSync(path.join(this.config_dir, 'files'))) {
      fs.mkdirSync(path.join(this.config_dir, 'files'), { recursive: true });
    }

    const dirtyFiles: GoogleFile[] = this.googleFileIds.length > 0 ?
      this.googleFiles.findFiles(item => this.googleFileIds.indexOf(item.id) > -1) :
      this.googleFiles.findFiles(item => !!item.dirty && !item.trashed);

    if (dirtyFiles.length > 0) {
      const debugInfo = JSON.stringify(dirtyFiles.slice(0, 10).map(item => item.id))
        .replace(']', (dirtyFiles.length > 10 ? ', ...' + (dirtyFiles.length - 10) + ' more]' : ']'));

      this.logger.info('Downloading modified files: ' + debugInfo);
    }

    this.progress.failed = 0;
    this.progress.completed = 0;
    this.progress.total = dirtyFiles.length;
    this.eventBus.emit('download:progress', this.progress);

    const ids = dirtyFiles.map(item => item.id);

    const CONCURRENCY = 32;

    const q = queue<GoogleFile>(async (file, callback) => {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

      // if (file.trashed) {
      //   this.googleFiles.markClean([ file ]));
      // } else
      if (file.mimeType === GoogleFiles.CONFLICT_MIME) {
        await this.googleFiles.markClean([ file ]);
      } else
      if (file.mimeType === GoogleFiles.REDIRECT_MIME) {
        await this.googleFiles.markClean([ file ]);
      } else
      if (file.mimeType === GoogleFiles.DRAWING_MIME) {
        await this.downloadDiagram(file, targetPath);
      } else
      if (file.mimeType === GoogleFiles.DOCUMENT_MIME) {
        await this.downloadDocument(file);
      } else
      if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        await this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
        await this.exportBinary(file, 'text/csv', 'csv');
      } else
      if (file.mimeType === 'application/vnd.google-apps.presentation') {
        await this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx');
        await this.exportBinary(file, 'application/pdf', 'pdf');
      } else
      if (file.mimeType === 'application/vnd.google-apps.form') {
        await this.exportBinary(file, 'application/zip', 'zip');
      } else
      if (file.size !== undefined) {
        await this.downloadAsset(file, targetPath);
      } else {
        await this.downloadAsset(file, targetPath);
      }

      this.progress.completed++;
      this.eventBus.emit('download:progress', this.progress);

      callback();
    }, CONCURRENCY);

    q.error(() => {
      this.progress.failed++;
      this.eventBus.emit('download:progress', this.progress);
    });

    if (dirtyFiles.length > 0) {
      for (const file of dirtyFiles) {
        q.push(file);
      }
      await q.drain();
    }


  /*    for (const error of errors) {
        const file = error?.reason?.file;
        if ('404' === String(error?.reason?.origError?.code) && file) {
          this.logger.info('File not found, trashed: ' + file.id);
          file.trashed = true;
          await this.googleFiles.merge([ file ]);
        }
      }
    } catch (ignore) { /!* eslint-disable-line no-empty *!/
    }
*/
    const dirtyFilesAfter = this.googleFiles.findFiles(item => ids.indexOf(item.id) > -1)
      .filter(item => !!item.dirty);

    if (dirtyFilesAfter.length > 0) {
      const debugInfo = JSON.stringify(dirtyFilesAfter.slice(0, 10).map(item => item.id))
          .replace(']', (dirtyFilesAfter.length > 10 ? ', ...' + (dirtyFilesAfter.length - 10) + ' more]' : ']'));

      this.logger.info('Download retry required: ' + debugInfo);
      this.eventBus.emit('download:failed', this.progress);
      process.nextTick(() => {
        this.eventBus.emit('download:retry');
      });
    } else {
      this.logger.info('Download done');
      this.eventBus.emit('download:done', this.progress);
      this.handlingFiles = false;
    }
  }

  private async ensureDir(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length < 2) {
      return;
    }
    parts.pop();

    if (!fs.existsSync(parts.join(path.sep))) {
      fs.mkdirSync(parts.join(path.sep), { recursive: true });
    }
  }

}
