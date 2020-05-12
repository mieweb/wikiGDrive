'use strict';

import path from 'path';
import fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {TocGenerator} from '../TocGenerator';
import {LinkTranslator} from '../LinkTranslator';
import {MarkDownTransform} from '../markdown/MarkDownTransform';
import {FrontMatterTransform} from '../markdown/FrontMatterTransform';
import {GoogleListFixer} from '../html/GoogleListFixer';
import {EmbedImageFixed} from '../html/EmbedImageFixed';
import {NavigationTransform} from '../NavigationTransform';

export class TransformPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.command = params.command;
    });
    eventBus.on('drive_config:loaded', async (drive_config) => {
      this.link_mode = drive_config['link_mode'];
      this.drive_config = drive_config;
  // await this.onConfigLoaded();
      this.flat_folder_structure = drive_config.flat_folder_structure;
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('external_files:initialized', ({ externalFiles }) => {
      this.externalFiles = externalFiles;
    });
  }

  async handleDirtyFiles() {
    this.linkTranslator = new LinkTranslator(this.filesStructure, this.externalFiles);
    if (this.link_mode) {
      this.linkTranslator.mode = this.link_mode;
    }

    const mergedFiles = this.filesStructure.findFiles(item => !!item.dirty); // TODO
    await this.transformDocuments(mergedFiles);
  }

  async transformDocuments(files) {
    files = files.filter(file => file.mimeType === FilesStructure.DOCUMENT_MIME);

    const navigationFile = files.find(file => file.name === '.navigation');

    const navigationTransform = new NavigationTransform(files, this.link_mode);

    if (navigationFile) {
      // const markDownTransform = new MarkDownTransform('.navigation', this.linkTranslator); // TODO
      // await this.googleDocsService.download(this.auth, navigationFile, [markDownTransform, navigationTransform], this.linkTranslator); // TODO
    }

    for (const file of files) {
      const targetPath = path.join(this.dest, file.localPath);

      const dest = fs.createWriteStream(targetPath);

      const markDownTransform = new MarkDownTransform(file.localPath, this.linkTranslator);
      const frontMatterTransform = new FrontMatterTransform(file, this.linkTranslator, navigationTransform.hierarchy);

      const destHtml = fs.readFileSync(path.join(this.config_dir, 'files', file.id + '.html')).toString();
      const googleListFixer = new GoogleListFixer(destHtml);
      const embedImageFixed = new EmbedImageFixed(destHtml);

      const gdocPath = path.join(this.config_dir, 'files', file.id + '.gdoc');

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
    }
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

  async ensureDir(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length < 2) {
      return;
    }
    parts.pop();

    fs.mkdirSync(parts.join(path.sep), { recursive: true });
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
      fs.mkdirSync(targetPath, { recursive: true });
    });

    fs.mkdirSync(path.join(this.dest, 'external_files'), { recursive: true });
  }

}
