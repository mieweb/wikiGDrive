'use strict';

import path from 'path';
import fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';
import {TocGenerator} from '../TocGenerator';
import {LinkTranslator} from '../LinkTranslator';

export class TransformPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('start', async (params) => {
      this.command = params.command;
    });
    eventBus.on('drive_config', async (drive_config) => {
      this.link_mode = drive_config['link_mode'];
      this.drive_config = drive_config;
  // await this.onConfigLoaded();
    });

  }


  todo() {

    this.linkTranslator = new LinkTranslator(this.filesStructure, this.externalFiles);
    if (this.link_mode) {
      this.linkTranslator.mode = this.link_mode;
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

}
