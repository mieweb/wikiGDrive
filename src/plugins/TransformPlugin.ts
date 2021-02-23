'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {TocGenerator} from '../TocGenerator';
import {LinkTranslator} from '../LinkTranslator';
import {MarkDownTransform} from '../markdown/MarkDownTransform';
import {FrontMatterTransform} from '../markdown/FrontMatterTransform';
import {GoogleListFixer} from '../html/GoogleListFixer';
import {EmbedImageFixer} from '../html/EmbedImageFixer';
import {NavigationTransform} from '../NavigationTransform';
import {ExternalToLocalTransform} from '../ExternalToLocalTransform';
import {TransformStatus} from '../storage/TransformStatus';
import {CliParams, LinkMode} from "../MainService";
import {DriveConfig} from './ConfigDirPlugin';
import {ExternalFiles} from '../storage/ExternalFiles';
import {ClearShortCodesTransform} from '../markdown/ClearShortCodesTransform';
import {SvgTransform} from '../SvgTransform';
import {UnZipper} from '../utils/UnZipper';

export class TransformPlugin extends BasePlugin {
  private command: string;
  private config_dir: string;
  private transformStatus: TransformStatus;
  private link_mode: LinkMode;
  private dest: string;
  private flat_folder_structure: boolean;
  private filesStructure: FilesStructure;
  private externalFiles: ExternalFiles;
  private linkTranslator: LinkTranslator;
  private force: boolean;

  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params: CliParams) => {
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
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('external_files:initialized', ({ externalFiles }) => {
      this.externalFiles = externalFiles;
    });
    eventBus.on('external:done', async () => {
      await this.handleTransform();
    });
    eventBus.on('main:transform_start', async () => {
      await this.handleTransform();
    });
    eventBus.on('main:transform_clear', async () => {
      await this.handleTransformClear();
    });
  }

  async handleTransform() {
    this.linkTranslator = new LinkTranslator(this.filesStructure, this.externalFiles);
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
      this.eventBus.emit('transform:clean');
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
        console.error('Error generating navigation hierarchy');
      }

    }

    return navigationTransform;
  }

  async getFilesToTransform(mimeType = FilesStructure.DOCUMENT_MIME) {
    const files = this.filesStructure.findFiles(file => !file.dirty && (mimeType === file.mimeType));
    const transformedFiles = this.transformStatus.findStatuses(() => true);

    const filesToTransform = [];

    for (const file of files) {
      const transformedFile = transformedFiles.find(transformedFile => transformedFile.id === file.id);
      if (transformedFile) {
        if (!fs.existsSync(path.join(this.externalFiles.getDest(), transformedFile.localPath))) {
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
    const filesToTransform = await this.getFilesToTransform(FilesStructure.DRAWING_MIME);
    console.log('Transforming diagrams: ' + filesToTransform.length);

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

      } catch (e) {
        console.error('Error transforming ' + file.id + '.svg [' + file.localPath + ']: ' + e.message);
        await this.filesStructure.markDirty([ file ]);
        await this.transformStatus.removeStatus(file.id);
      }

    }
  }

  async deleteTrashed() {
    const files = this.filesStructure.findFiles(file => file.trashed);

    let removed = [];

    for (const file of files) {
      const removePath = path.join(this.dest, file.localPath);
      if (fs.existsSync(removePath)) {
        fs.unlinkSync(removePath);
        removed.push(file.id);
      }
    }

    console.log('Removed trashed:', removed);
  }

  async transformDocuments() {
    const files = this.filesStructure.findFiles(file => !file.dirty && file.mimeType === FilesStructure.DOCUMENT_MIME);
    const navigationFile = files.find(file => file.name === '.navigation');
    const navigationTransform = await this.transformNavigation(files, navigationFile);

    const filesToTransform = await this.getFilesToTransform();
    console.log('Transforming documents: ' + filesToTransform.length);

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
        const frontMatterTransform = new FrontMatterTransform(file, this.linkTranslator, navigationTransform.hierarchy);

        if (!fs.existsSync(path.join(this.config_dir, 'files', file.id + '.zip'))) {
          await this.filesStructure.markDirty([ file ]);
          throw new Error('Zip version of document is not downloaded (marking dirty): ' + path.join(this.config_dir, 'files', file.id + '.zip'));
        }

        const unZipper = new UnZipper(this.externalFiles);
        await unZipper.load(path.join(this.config_dir, 'files', file.id + '.zip'));

        const googleListFixer = new GoogleListFixer(unZipper.getHtml());
        const embedImageFixer = new EmbedImageFixer(unZipper.getHtml(), unZipper.getImages());
        const externalToLocalTransform = new ExternalToLocalTransform(this.filesStructure, this.externalFiles);
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

      } catch (e) {
        console.error('Error transforming ' + file.id + '.html [' + file.localPath + ']: ' + e.message);
        await this.filesStructure.markDirty([ file ]);
        await this.transformStatus.removeStatus(file.id);
      }

    }
  }

  async removeConflicts() {
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.CONFLICT_MIME);

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
    const filesMap = this.filesStructure.getFileMap();
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.CONFLICT_MIME);

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
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.REDIRECT_MIME);

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
    const filesMap = this.filesStructure.getFileMap();
    const files = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.REDIRECT_MIME);

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
    const writeStream = fs.createWriteStream(path.join(this.dest, 'toc.md'));
    await tocGenerator.generate(this.filesStructure, writeStream);
    writeStream.end();
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
    let directories = allFiles.filter(file => file.mimeType === FilesStructure.FOLDER_MIME);

    if (this.flat_folder_structure) {
      directories = directories.filter(dir => {
        return !!allFiles.find(file => file.mimeType !== FilesStructure.FOLDER_MIME && file.desiredLocalPath.startsWith(dir.desiredLocalPath));
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
          console.log('Cleared: ' + localPath);
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
