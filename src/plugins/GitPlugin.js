'use strict';

import path from 'path';
import fs from 'fs';
import SimpleGit from 'simple-git/promise';
import {spawn} from 'child_process';

import {BasePlugin} from './BasePlugin';
import {FilesStructure} from '../storage/FilesStructure';

export class GitPlugin extends BasePlugin {
  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.dest = params.dest;
      this.config_dir = params.config_dir;
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('transform:clean', async () => {
      await this.processGit();
      eventBus.emit('git:done');
    });
  }

  async processGit() {
    try {
      const repository = SimpleGit(this.dest);
      const status = await repository.status();

      const documents = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.DOCUMENT_MIME);
      // console.log('status', status);

      const not_added = documents.filter(doc => status.not_added.indexOf(doc.localPath) > -1);

      if (not_added.length > 0) {
        await this.fireHook('doc_new', not_added.map(file => file.localPath));
      }
    } catch (err) {
      console.error(err.message);
    }
  }

  async fireHook(hook_name, params) {
    const hook_path = path.join(this.config_dir, 'hooks', hook_name);

    if (fs.existsSync(hook_path)) {
      console.log(hook_path);
      const process = spawn(hook_path, params);

      process.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      process.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      await new Promise((resolve, reject) => {
        process.on('exit', (code) => {
          if (code) {
            reject(code);
          } else {
            resolve();
          }
        });
      });
    }
  }

}
