'use strict';

import * as path from 'path';
import * as fs from 'fs';
import {queue} from 'async';

import {BasePlugin} from './BasePlugin';
import {GoogleFile, GoogleFilesStorage, MimeTypes} from '../storage/GoogleFilesStorage';
import {FileService} from '../utils/FileService';
import {StringWritable} from '../utils/StringWritable';
import {BufferWritable} from '../utils/BufferWritable';
import {GoogleDocsService} from '../google/GoogleDocsService';
import {GoogleDriveService} from '../google/GoogleDriveService';
import {CliParams} from '../MainService';
import {DownloadFile, DownloadFileImage, DownloadFilesStorage, ImageMeta} from '../storage/DownloadFilesStorage';
import {extractDocumentImages} from '../utils/extractDocumentLinks';
import {UnZipper} from '../utils/UnZipper';
import {getImageMeta} from '../utils/getImageMeta';

export class DownloadPlugin extends BasePlugin {
  private fileService: FileService;
  private googleDocsService: GoogleDocsService;
  private config_dir: string;
  private googleFilesStorage: GoogleFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private auth: any;
  private googleDriveService: GoogleDriveService;

  private readonly progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private handlingFiles = false;
  private googleFileIds: string[];

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.fileService = new FileService();

    this.progress = {
      failed: 0,
      completed: 0,
      total: 0
    };

    this.googleDocsService = new GoogleDocsService(this.logger);

    this.googleFileIds = [];
    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });
    eventBus.on('main:run', async (params: CliParams) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('google_files:initialized', ({ googleFilesStorage }) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('download_files:initialized', ({ downloadFilesStorage }) => {
      this.downloadFilesStorage = downloadFilesStorage;
    });
    eventBus.on('google_api:done', ({ auth, googleDriveService }) => {
      this.auth = auth;
      this.googleDriveService = googleDriveService;
    });
    eventBus.on('download:run', async () => {
      await this.start();
    });
    eventBus.on('download:retry', async () => {
      await this.start();
    });
  }

  private async removeFile(fileId) {
    const targetDir = path.join(this.config_dir, 'files');
    const files = fs.readdirSync(targetDir);

    for (const fileName of files) {
      const parsed = path.parse(fileName);
      if (parsed.name === fileId) {
        fs.unlinkSync(path.join(this.config_dir, 'files', fileName));
      }
    }
    await this.downloadFilesStorage.removeFile(fileId);
  }

  private async downloadAsset(file: GoogleFile): Promise<DownloadFile> {
    const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
    this.logger.info('Downloading asset: ' + file.name);

    const dest = fs.createWriteStream(targetPath);
    await this.googleDriveService.download(this.auth, file, dest);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime
    };
  }

  private async downloadDiagram(file: GoogleFile): Promise<DownloadFile> {
    const targetPathSvg = path.join(this.config_dir, 'files', file.id + '.svg');
    const targetPathPng = path.join(this.config_dir, 'files', file.id + '.png');
    this.logger.info('Downloading diagram: ' + file.name);

    const writeStream = fs.createWriteStream(targetPathSvg);
    await this.googleDriveService.exportDocument(
      this.auth,
      Object.assign({}, file, { mimeType: 'image/svg+xml' }),
      writeStream);

    const writeStreamPng = fs.createWriteStream(targetPathPng);

    await this.googleDriveService.exportDocument(
      this.auth,
      Object.assign({}, file, { mimeType: 'image/png' }),
      writeStreamPng);

    const md5Checksum = await this.fileService.md5File(targetPathPng);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      md5Checksum,
      image: await getImageMeta(await this.fileService.readBuffer(targetPathPng))
    };
  }

  private async downloadDocument(file: GoogleFile): Promise<DownloadFile> {
    const zipPath = path.join(this.config_dir, 'files', file.id + '.zip');
    const gdocPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

    const destZip = new BufferWritable();
    const destJson = new StringWritable();

    await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType: 'application/zip', name: file.name }, destZip);
    await this.googleDocsService.download(this.auth, file, destJson);

    fs.writeFileSync(zipPath, destZip.getBuffer());
    fs.writeFileSync(gdocPath, destJson.getString());

    const document = JSON.parse(destJson.getString());
    const images: DownloadFileImage[] = await extractDocumentImages(document);

    const unZipper = new UnZipper();
    await unZipper.load(fs.readFileSync(zipPath));
    const zipImages: ImageMeta[] = unZipper.getImages();
    for (let imageNo = 0; imageNo < images.length; imageNo++) {
      if (imageNo < zipImages.length) {
        images[imageNo].zipImage = zipImages[imageNo];
      }
    }

    // await addZipImages(images);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      images
    };
  }

  private async exportBinary(file: GoogleFile, mimeType, ext): Promise<DownloadFile> {
    const extPath = path.join(this.config_dir, 'files', file.id + '.' + ext);

    await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType, name: file.name }, fs.createWriteStream(extPath));

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
    };
  }

  private async start() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    if (!fs.existsSync(path.join(this.config_dir, 'files'))) {
      fs.mkdirSync(path.join(this.config_dir, 'files'), { recursive: true });
    }

    const toRemove = this.downloadFilesStorage.findFiles(dFile => {
      return !this.googleFilesStorage.containsFile(dFile.id);
    });
    for (const file of toRemove) {
      await this.removeFile(file.id);
    }

    const downloadedFiles = this.downloadFilesStorage.findFiles(item => !!item);
    const googleFiles: GoogleFile[] = [];

    if (this.googleFileIds.length > 0) {
      const foundFiles = this.googleFilesStorage.findFiles(item => this.googleFileIds.indexOf(item.id) > -1);
      if (foundFiles.length === 1 && foundFiles[0].mimeType === MimeTypes.FOLDER_MIME) {
        // downloadAll
      } else {
        googleFiles.push(...foundFiles.filter(file => file.mimeType !== MimeTypes.FOLDER_MIME));
      }
    } else {
      const foundFiles = this.googleFilesStorage.findFiles(item => {
        if (item.mimeType === MimeTypes.FOLDER_MIME) {
          return false;
        }
        const dFile = downloadedFiles.find(dFile => dFile.id === item.id);
        if (dFile && dFile.modifiedTime === item.modifiedTime) {
          return false;
        }
        return true;
      });
      googleFiles.push(...foundFiles);
    }

    if (googleFiles.length > 0) {
      const debugInfo = JSON.stringify(googleFiles.slice(0, 10).map(item => item.id))
        .replace(/]$/, (googleFiles.length > 10 ? ', ...' + (googleFiles.length - 10) + ' more]' : ']'));

      this.logger.info('Downloading modified files: ' + debugInfo);
    }

    this.progress.failed = 0;
    this.progress.completed = 0;
    this.progress.total = googleFiles.length;
    this.eventBus.emit('download:progress', this.progress);

    const CONCURRENCY = 16;

    const q = queue<GoogleFile>(async (file, callback) => {
      let downloadedFile: DownloadFile;

      try {
        if (file.mimeType === MimeTypes.DRAWING_MIME) {
          downloadedFile = await this.downloadDiagram(file);
        } else
        if (file.mimeType === MimeTypes.DOCUMENT_MIME) {
          downloadedFile = await this.downloadDocument(file);
        } else
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          downloadedFile = await this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
          await this.exportBinary(file, 'text/csv', 'csv');
        } else
        if (file.mimeType === 'application/vnd.google-apps.presentation') {
          downloadedFile = await this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx');
          await this.exportBinary(file, 'application/pdf', 'pdf');
        } else
        if (file.mimeType === 'application/vnd.google-apps.form') {
          downloadedFile = await this.exportBinary(file, 'application/zip', 'zip');
        } else {
          downloadedFile = await this.downloadAsset(file);
        }

        if (downloadedFile) {
          await this.downloadFilesStorage.updateFile(downloadedFile);
        }

        this.progress.completed++;
        this.eventBus.emit('download:progress', this.progress);
        callback();
      } catch (err) {
        callback(err);
      }
    }, CONCURRENCY);

    q.error(async (error, file) => {
      await this.removeFile(file.id);
      if (error['isQuotaError']) {
        q.push(file);
      } else {
        this.logger.error(error);
        console.error(error);
        this.progress.failed++;
        this.eventBus.emit('download:progress', this.progress);
      }
    });

    if (googleFiles.length > 0) {
      for (const file of googleFiles) {
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

/*
    const dirtyFilesAfter = this.googleFilesStorage.findFiles(item => ids.indexOf(item.id) > -1)
      .filter(item => !!item.dirty);

    if (dirtyFilesAfter.length > 0) {
      const debugInfo = JSON.stringify(dirtyFilesAfter.slice(0, 10).map(item => item.id))
          .replace(/]$/, (dirtyFilesAfter.length > 10 ? ', ...' + (dirtyFilesAfter.length - 10) + ' more]' : ']'));

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
*/

    this.logger.info('Download done');
    this.eventBus.emit('download:done', this.progress);

    if (this.googleFileIds.length === 0) {
      this.eventBus.emit('download:complete');
    }
    this.handlingFiles = false;
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

/*
  async cleanupDir() {
    const files = this.googleFilesStorage.findFiles(item => MimeTypes.DOCUMENT_MIME === item.mimeType);
    const fileService = new FileService();

    for (const file of files) {
      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
      if (await fileService.exists(targetPath) && await fileService.getSize(targetPath) === 0) {
        await fileService.remove(targetPath);
      }
    }
  }

  async scanFileSystem() {
    const files = this.googleFilesStorage.findFiles(item => !item.dirty);
    const fileService = new FileService();

    for (const file of files) {
      let targetPath;
      switch (file.mimeType) {
        case MimeTypes.DOCUMENT_MIME:
          targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');
          break;
        case MimeTypes.DRAWING_MIME:
          targetPath = path.join(this.config_dir, 'files', file.id + '.svg');
          break;
      }

      if (!targetPath) {
        continue;
      }

      if (!await fileService.exists(targetPath)) {
        await this.googleFilesStorage.markDirty([file]);
      } else
      if (await fileService.getSize(targetPath) === 0) {
        await this.googleFilesStorage.markDirty([file]);
      }
    }
  }
*/

}
