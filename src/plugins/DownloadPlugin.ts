'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';
import {StringWritable} from '../utils/StringWritable';
import {BufferWritable} from '../utils/BufferWritable';
import {GoogleDocsService} from '../google/GoogleDocsService';
import {GoogleDriveService} from '../google/GoogleDriveService';
import {ExternalFiles} from "../storage/ExternalFiles";
import {CliParams} from "../MainService";

export class DownloadPlugin extends BasePlugin {
  private googleDocsService: GoogleDocsService;
  private config_dir: string;
  private filesStructure: FilesStructure;
  private auth: any;
  private googleDriveService: GoogleDriveService;
  private externalFiles: ExternalFiles;
  private debug: string[];

  constructor(eventBus, logger) {
    super(eventBus, logger);

    this.googleDocsService = new GoogleDocsService();

    eventBus.on('main:init', async (params: CliParams) => {
      this.config_dir = params.config_dir;
      this.debug = params.debug;
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('external_files:initialized', ({ externalFiles }) => {
      this.externalFiles = externalFiles;
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

  private async downloadAsset(file, targetPath) {
    console.log('Downloading asset: ' + file.localPath);
    await this.ensureDir(targetPath);

    try {
      const dest = fs.createWriteStream(targetPath);
      await this.googleDriveService.download(this.auth, file, dest);
    } catch (err) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      throw err;
    }

    await this.filesStructure.  markClean([ file ]);
  }

  private async downloadDiagram(file, targetPath) {
    console.log('Downloading diagram: ' + file.localPath);
    await this.ensureDir(targetPath);

    try {
      const writeStream = fs.createWriteStream(targetPath.replace(/.gdoc$/, '.svg'));
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
      const writeStreamPng = fs.createWriteStream(targetPath.replace(/.gdoc$/, '.png'));

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
    const md5Checksum = await fileService.md5File(targetPath.replace(/.gdoc$/, '.png'));

    await this.externalFiles.putFile({
      localPath: file.localPath.replace(/.svg$/, '.png'),
      localDocumentPath: file.localPath,
      md5Checksum: md5Checksum
    });
    await this.filesStructure.markClean([ file ]);
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

      fs.writeFileSync(zipPath, destZip.getBuffer())
      fs.writeFileSync(gdocPath, destJson.getString());
      await this.filesStructure.markClean([ file ]);
    } catch (err) {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(gdocPath)) fs.unlinkSync(gdocPath);
      await this.filesStructure.markDirty([ file ]);
      throw err;
    }
  }

  private async exportBinary(file, mimeType, ext) {
    const extPath = path.join(this.config_dir, 'files', file.id + '.' + ext);

    await this.ensureDir(extPath);

    try {
      await this.googleDriveService.exportDocument(this.auth, { id: file.id, mimeType, localPath: file.localPath }, fs.createWriteStream(extPath));
      await this.filesStructure.markClean([ file ]);
    } catch (err) {
      if (fs.existsSync(extPath)) fs.unlinkSync(extPath);
      await this.filesStructure.markDirty([ file ]);
      throw err;
    }
  }

  private async handleDirtyFiles() {
    if (!fs.existsSync(path.join(this.config_dir, 'files'))) {
      fs.mkdirSync(path.join(this.config_dir, 'files'), { recursive: true });
    }

    const promises = [];
    const dirtyFiles = this.filesStructure.findFiles(item => !!item.dirty && !item.trashed);

    if (dirtyFiles.length > 0) {
      this.logger.info('Downloading modified files (' + dirtyFiles.length + ')');
    }

    const exportFormats = [
      {
        "source": "application/vnd.google-apps.document",
        "targets": [
          "application/rtf",
          "application/vnd.oasis.opendocument.text",
          "text/html",
          "application/pdf",
          "application/epub+zip",
          "application/zip",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain"
        ]
      },
      {
        "source": "application/vnd.google-apps.spreadsheet",
        "targets": [
          "application/x-vnd.oasis.opendocument.spreadsheet",
          "text/tab-separated-values",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "application/zip",
          "application/vnd.oasis.opendocument.spreadsheet"
        ]
      },
      {
        "source": "application/vnd.google-apps.jam",
        "targets": [
          "application/pdf"
        ]
      },
      {
        "source": "application/vnd.google-apps.script",
        "targets": [
          "application/vnd.google-apps.script+json"
        ]
      },
      {
        "source": "application/vnd.google-apps.presentation",
        "targets": [
          "application/vnd.oasis.opendocument.presentation",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "text/plain"
        ]
      },
      {
        "source": "application/vnd.google-apps.form",
        "targets": [
          "application/zip"
        ]
      },
      {
        "source": "application/vnd.google-apps.drawing",
        "targets": [
          "image/svg+xml",
          "image/png",
          "application/pdf",
          "image/jpeg"
        ]
      },
      {
        "source": "application/vnd.google-apps.site",
        "targets": [
          "text/plain"
        ]
      }
    ];

    for (const file of dirtyFiles) {

      const targetPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

      if (file.trashed) {
        promises.push(this.filesStructure.markClean([ file ]));
      } else
      if (file.mimeType === FilesStructure.CONFLICT_MIME) {
        promises.push(this.filesStructure.markClean([ file ]));
      } else
      if (file.mimeType === FilesStructure.REDIRECT_MIME) {
        promises.push(this.filesStructure.markClean([ file ]));
      } else
      if (file.mimeType === FilesStructure.DRAWING_MIME) {
        promises.push(this.downloadDiagram(file, targetPath));
      } else
      if (file.mimeType === FilesStructure.DOCUMENT_MIME) {
        promises.push(this.downloadDocument(file));
      } else
      if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        promises.push(this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'));
        promises.push(this.exportBinary(file, 'text/csv', 'csv'));
      } else
      if (file.mimeType === 'application/vnd.google-apps.presentation') {
        promises.push(this.exportBinary(file, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'));
        promises.push(this.exportBinary(file, 'application/pdf', 'pdf'));
      } else
      if (file.mimeType === 'application/vnd.google-apps.form') {
        promises.push(this.exportBinary(file, 'application/zip', 'zip'));
      } else
      if (file.size !== undefined) {
        promises.push(this.downloadAsset(file, targetPath));
      } else {
        promises.push(this.downloadAsset(file, targetPath));
      }
    }

    try {
      const settled = await Promise.allSettled(promises);
      const errors = <any[]>settled.filter(item => item.status === 'rejected');

      for (const error of errors) {
        const file = error?.reason?.file;
        if ('404' === String(error?.reason?.origError?.code) && file) {
          console.log('File not found, trashed:', file.id);
          file.trashed = true;
          await this.filesStructure.merge([ file ]);
        }
      }
    } catch (ignore) { /* eslint-disable-line no-empty */
    }

    const dirtyFilesAfter = this.filesStructure.findFiles(item => !!item.dirty && !item.trashed);
    if (dirtyFilesAfter.length > 0) {
      if (this.debug.indexOf('download') > -1) {
        console.log('dirtyFilesAfter', dirtyFilesAfter);
      }
      console.log('Download retry required');
      process.nextTick(() => {
        this.eventBus.emit('download:retry');
      });
    } else {
      this.eventBus.emit('download:clean');
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
