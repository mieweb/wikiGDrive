'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {GoogleFiles, MimeTypes} from '../storage/GoogleFiles';
import {TocGenerator} from '../TocGenerator';
import {LinkTranslator} from '../LinkTranslator';
import {MarkDownTransform} from '../markdown/MarkDownTransform';
import {FrontMatterTransform} from '../markdown/FrontMatterTransform';
import {GoogleListFixer} from '../html/GoogleListFixer';
import {EmbedImageFixer} from '../html/EmbedImageFixer';
import {NavigationTransform} from '../NavigationTransform';
import {ExternalToLocalTransform} from '../ExternalToLocalTransform';
import {TransformStatus} from '../storage/TransformStatus';
import {CliParams, LinkMode} from '../MainService';
import {DriveConfig} from './ConfigDirPlugin';
import {ExternalFiles} from '../storage/ExternalFiles';
import {ClearShortCodesTransform} from '../markdown/ClearShortCodesTransform';
import {SvgTransform} from '../SvgTransform';
import {UnZipper} from '../utils/UnZipper';
import {StringWritable} from '../utils/StringWritable';

export class TransformPlugin extends BasePlugin {
  private command: string;
  private config_dir: string;
  private transformStatus: TransformStatus;
  private link_mode: LinkMode;
  private dest: string;
  private flat_folder_structure: boolean;
  private googleFiles: GoogleFiles;
  private externalFiles: ExternalFiles;
  private linkTranslator: LinkTranslator;
  private force: boolean;
  private oldTocString: string;

  private progressDocs: {
    failed: number;
    completed: number;
    total: number;
  };
  private progressDiags: {
    failed: number;
    completed: number;
    total: number;
  };

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    eventBus.on('main:run', async (params: CliParams) => {
      this.command = params.command;
      this.config_dir = params.config_dir;
      this.force = !!params.force;

      this.transformStatus = new TransformStatus(this.config_dir);
      await this.transformStatus.init();
    });
    eventBus.on('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.link_mode = drive_config['link_mode'];
      this.dest = drive_config.dest;
      this.flat_folder_structure = drive_config.flat_folder_structure;
    });
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('external_files:initialized', ({ externalFiles }) => {
      this.externalFiles = externalFiles;
    });
    eventBus.on('transform:run', async () => {
      await this.handleTransform();
    });
    eventBus.on('transform:clear', async () => {
      await this.handleTransformClear();
    });
  }

  async handleTransform() {
    this.linkTranslator = new LinkTranslator(this.googleFiles, this.externalFiles);
    if (this.link_mode) {
      this.linkTranslator.setMode(this.link_mode);
    }

    // await this.createFolderStructure(files);
    await this.transformDiagrams();
    await this.transformDocuments();
    await this.generateMetaFiles();
    await this.deleteTrashed();

    const filesToTransform = await this.getFilesToTransform();
    if (filesToTransform.length > 0) {
      this.eventBus.emit('transform:dirty');
    } else {
      this.eventBus.emit('transform:done');
    }
  }

  async transformNavigation(files, navigationFile) {
    const navigationTransform = new NavigationTransform(files, this.link_mode);
    if (navigationFile) {
      const markDownTransform = new MarkDownTransform('.navigation', this.linkTranslator);

      try {
        const gdocPath = path.join(this.config_dir, 'files', navigationFile.id + '.gdoc');

        const stream = fs.createReadStream(gdocPath)
          .pipe(markDownTransform)
          .pipe(navigationTransform);

        await new Promise((resolve, reject) => {
          stream.on('finish', () => {
            resolve();
          });
          stream.on('error', err => {
            reject(err);
          });
        });
      } catch (e) {
        this.logger.error('Error generating navigation hierarchy');
      }
    }

    return navigationTransform;
  }

  async getFilesToTransform(mimeType = MimeTypes.DOCUMENT_MIME) {
    const files = this.googleFiles.findFiles(file => !file.dirty && (mimeType === file.mimeType));
    const transformedFiles = this.transformStatus.findStatuses(() => true);

    const filesToTransform = [];

    for (const file of files) {
      const transformedFile = transformedFiles.find(transformedFile => transformedFile.id === file.id);
      if (transformedFile) {
        if (!fs.existsSync(path.join(this.externalFiles.getDest(), transformedFile.localPath))) { // eslint-disable-line no-empty
        } else if (transformedFile && transformedFile.modifiedTime === file.modifiedTime) {
          continue;
        }
      }

      const status = Object.assign({}, file);
      if (transformedFile) {
        status.oldLocalPath = transformedFile.localPath;
      }
      filesToTransform.push(status);
    }

    return filesToTransform;
  }

  async transformDiagrams() {
    const filesToTransform = await this.getFilesToTransform(MimeTypes.DRAWING_MIME);
    this.logger.info('Transforming diagrams: ' + filesToTransform.length);

    this.progressDiags = {
      failed: 0,
      completed: 0,
      total: filesToTransform.length
    };

    this.eventBus.emit('transform:diagrams:progress', this.progressDiags);

    for (const file of filesToTransform) {
      if (file.oldLocalPath) {
        const removePath = path.join(this.dest, file.oldLocalPath);
        if (fs.existsSync(removePath)) fs.unlinkSync(removePath);
      }

      const targetPath = path.join(this.dest, file.localPath);

      try {
        await this.ensureDir(targetPath);
        const dest = fs.createWriteStream(targetPath);

        const svgTransform = new SvgTransform(file.localPath, this.linkTranslator);

        const gdocPath = path.join(this.config_dir, 'files', file.id + '.svg');

        await new Promise((resolve, reject) => {
          dest.on('error', err => {
            reject(err);
          });

          const stream = fs.createReadStream(gdocPath)
              .pipe(svgTransform)
              .pipe(dest);

          stream.on('finish', () => {
            resolve();
          });
          stream.on('error', err => {
            reject(err);
          });
        });

        await this.transformStatus.addStatus(file.id, {
          id: file.id,
          modifiedTime: file.modifiedTime,
          localPath: file.localPath
        });

        this.progressDiags.completed++;
        this.eventBus.emit('transform:diagrams:progress', this.progressDiags);
      } catch (e) {
        this.logger.error('Error transforming ' + file.id + '.svg [' + file.localPath + ']: ' + e.message);
        await this.googleFiles.markDirty([ file ]);
        await this.transformStatus.removeStatus(file.id);

        this.progressDiags.failed++;
        this.eventBus.emit('transform:diagrams:progress', this.progressDiags);
      }

    }

    if (this.progressDiags.failed === 0) {
      this.eventBus.emit('transform:diagrams:done', this.progressDiags);
    } else {
      this.eventBus.emit('transform:diagrams:failed', this.progressDiags);
    }
  }

  async deleteTrashed() {
    const files = this.googleFiles.findFiles(file => file.trashed);

    const removed = [];

    for (const file of files) {
      const removePath = path.join(this.dest, file.localPath);
      if (fs.existsSync(removePath)) {
        fs.unlinkSync(removePath);
        removed.push(file.id);
      }
    }

    this.logger.info('Removed trashed:' + JSON.stringify(removed));
  }

  async transformDocuments() {
    const files = this.googleFiles.findFiles(file => !file.dirty && file.mimeType === MimeTypes.DOCUMENT_MIME);
    const navigationFile = files.find(file => file.name === '.navigation');
    const navigationTransform = await this.transformNavigation(files, navigationFile);

    const filesToTransform = await this.getFilesToTransform();
    this.logger.info('Transforming documents: ' + filesToTransform.length);

    this.progressDocs = {
      failed: 0,
      completed: 0,
      total: filesToTransform.length
    };

    this.eventBus.emit('transform:documents:progress', this.progressDocs);

    for (const file of filesToTransform) {
      if (file.oldLocalPath) {
        const removePath = path.join(this.dest, file.oldLocalPath);
        if (fs.existsSync(removePath)) fs.unlinkSync(removePath);
      }

      const targetPath = path.join(this.dest, file.localPath);

      try {
        await this.ensureDir(targetPath);
        const dest = fs.createWriteStream(targetPath);

        const markDownTransform = new MarkDownTransform(file.localPath, this.linkTranslator);
        const frontMatterTransform = new FrontMatterTransform(file, this.linkTranslator, navigationTransform.getHierarchy());

        if (!fs.existsSync(path.join(this.config_dir, 'files', file.id + '.zip'))) {
          await this.googleFiles.markDirty([ file ]);
          throw new Error('Zip version of document is not downloaded (marking dirty): ' + path.join(this.config_dir, 'files', file.id + '.zip'));
        }

        const unZipper = new UnZipper(this.externalFiles);
        await unZipper.load(path.join(this.config_dir, 'files', file.id + '.zip'));

        const googleListFixer = new GoogleListFixer(unZipper.getHtml());
        const embedImageFixer = new EmbedImageFixer(unZipper.getHtml(), unZipper.getImages());
        const externalToLocalTransform = new ExternalToLocalTransform(this.googleFiles, this.externalFiles);
        const clearShortCodesTransform = new ClearShortCodesTransform(false);

        const gdocPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

        await new Promise((resolve, reject) => {
          dest.on('error', err => {
            reject(err);
          });

          const stream = fs.createReadStream(gdocPath)
              .pipe(googleListFixer)
              .pipe(embedImageFixer)
              .pipe(externalToLocalTransform)
              .pipe(markDownTransform)
              .pipe(frontMatterTransform)
              .pipe(clearShortCodesTransform)
              .pipe(dest);

          stream.on('finish', () => {
            resolve();
          });
          stream.on('error', err => {
            reject(err);
          });
        });

        await this.transformStatus.addStatus(file.id, {
          id: file.id,
          modifiedTime: file.modifiedTime,
          localPath: file.localPath
        });

        this.progressDocs.completed++;
        this.eventBus.emit('transform:documents:progress', this.progressDocs);
      } catch (e) {
        this.progressDocs.failed++;
        this.eventBus.emit('transform:documents:progress', this.progressDocs);
        this.logger.error('Error transforming ' + file.id + '.html [' + file.localPath + ']: ' + e.message);
        await this.googleFiles.markDirty([ file ]);
        await this.transformStatus.removeStatus(file.id);
      }

    }

    if (this.progressDocs.failed === 0) {
      this.eventBus.emit('transform:documents:done', this.progressDocs);
    } else {
      this.eventBus.emit('transform:documents:failed', this.progressDocs);
    }
  }

  async removeConflicts() {
    const files = this.googleFiles.findFiles(file => file.mimeType === MimeTypes.CONFLICT_MIME);

    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }
    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);
      await this.removeEmptyDir(targetPath);
    }
  }

  async generateConflicts() {
    const filesMap = this.googleFiles.getFileMap();
    const files = this.googleFiles.findFiles(file => file.mimeType === MimeTypes.CONFLICT_MIME);

    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);
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

  async removeRedirects() {
    const files = this.googleFiles.findFiles(file => file.mimeType === MimeTypes.REDIRECT_MIME);

    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }
    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);
      await this.removeEmptyDir(targetPath);
    }
  }

  async generateRedirects() {
    const filesMap = this.googleFiles.getFileMap();
    const files = this.googleFiles.findFiles(file => file.mimeType === MimeTypes.REDIRECT_MIME);

    for (const file of files) {
      if (!file.localPath) {
        continue;
      }

      const targetPath = path.join(this.dest, file.localPath);
      await this.ensureDir(targetPath);
      const dest = fs.createWriteStream(targetPath);

      const newFile = filesMap[file.redirectTo];

      if (newFile['trashed']) {
        continue;
      }

      let frontMatter = '---\n';
      frontMatter += 'title: "' + file.name + '"\n';
      frontMatter += 'date: ' + file.modifiedTime + '\n';
      const htmlPath = this.linkTranslator.convertToRelativeMarkDownPath(file.localPath, '');
      if (htmlPath) {
        frontMatter += 'url: "' + htmlPath + '"\n';
      }
      if (file.lastAuthor) {
        frontMatter += 'author: ' + file.lastAuthor + '\n';
      }
      if (file.version) {
        frontMatter += 'version: ' + file.version + '\n';
      }
      frontMatter += 'id: ' + file.id + '\n';
      frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + file.id + '\n';

      frontMatter += '---\n';

      let md = frontMatter;
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
    const writeStream = new StringWritable();
    await tocGenerator.generate(this.googleFiles, writeStream);

    const tocString = writeStream.getString();

    if (this.oldTocString !== tocString) {
      fs.writeFileSync(path.join(this.dest, 'toc.md'), tocString);
      this.oldTocString = tocString;
    }
  }

  async ensureDir(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length < 2) {
      return;
    }
    parts.pop();

    if (!fs.existsSync(parts.join(path.sep))) {
      fs.mkdirSync(parts.join(path.sep), { recursive: true });
    }
  }

  async removeEmptyDir(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length < 2) {
      return;
    }
    parts.pop();

    const dirPath = parts.join(path.sep);
    if (fs.existsSync(dirPath)) { // isempty
      const isEmpty = fs.readdirSync(dirPath).length === 0;
      if (isEmpty) {
        fs.rmdirSync(dirPath);
      }
    }
  }

  createFolderStructure(allFiles) {
    let directories = allFiles.filter(file => file.mimeType === MimeTypes.FOLDER_MIME);

    if (this.flat_folder_structure) {
      directories = directories.filter(dir => {
        return !!allFiles.find(file => file.mimeType !== MimeTypes.FOLDER_MIME && file.desiredLocalPath.startsWith(dir.desiredLocalPath));
      });
    }

    directories.sort((a, b) => {
      return a.localPath.length - b.localPath.length;
    });

    directories.forEach(directory => {
      const targetPath = path.join(this.dest, directory.localPath);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
    });
  }


  async removeMetaFiles() {
    await this.removeConflicts();
    await this.removeRedirects();

    if (fs.existsSync(path.join(this.dest, 'toc.md'))) {
      fs.unlinkSync(path.join(this.dest, 'toc.md'));
    }
  }

  async handleTransformClear() {
    const transformedFiles = this.transformStatus.findStatuses(() => true);

    transformedFiles.sort((a, b) => {
      return b.localPath.length - a.localPath.length;
    });

    for (const file of transformedFiles) {
      if (file.localPath) {
        const localPath = path.join(this.dest, file.localPath);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          this.logger.info('Cleared: ' + localPath);
        }
        await this.removeEmptyDir(localPath);
      }

      await this.transformStatus.removeStatus(file.id);
    }

    await this.removeMetaFiles();

    this.eventBus.emit('transform:cleared');
  }

  async flushData() {
    await this.transformStatus.flushData();
  }

}
