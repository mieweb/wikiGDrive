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

    this.gitUpdateMinutesDelay = 60;

    eventBus.on('main:init', async (params) => {
      this.dest = params.dest;
      this.config_dir = params.config_dir;

      if (params.git_update_delay) {
        if (typeof params.git_update_delay === 'string') {
          if (params.git_update_delay.endsWith('m')) {
            params.git_update_delay = parseInt(params.git_update_delay.substr(0, params.git_update_delay.length - 1));
          } else
          if (params.git_update_delay.endsWith('m')) {
            params.git_update_delay = parseInt(params.git_update_delay.substr(0, params.git_update_delay.length - 1)) * 60;
          }
        }

        if (params.git_update_delay > 0) {
          this.gitUpdateMinutesDelay = params.git_update_delay;
        }
      }

      fs.mkdirSync(path.join(params.config_dir, 'hooks'), { recursive: true });
      await this.createHookExamples();
    });
    eventBus.on('files_structure:initialized', ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('transform:clean', async () => {
      await this.processGit();
      eventBus.emit('git:done');
    });
  }

  async createHookExamples() {
    fs.writeFileSync(path.join(this.config_dir, 'hooks', 'md_new.example'), `#!/bin/sh

git add $@
git commit -m "Autocommit new files" $@
`);

    fs.writeFileSync(path.join(this.config_dir, 'hooks', 'md_update.example'), `#!/bin/sh

git add $@
git commit -m "Autocommit updated files" $@
`);
  }

  async processGit() {
    try {
      const repository = SimpleGit(this.dest);
      const status = await repository.status();

      const documents = this.filesStructure.findFiles(file => file.mimeType === FilesStructure.DOCUMENT_MIME);
      // console.log('status', status);

      const not_added = documents.filter(doc => status.not_added.indexOf(doc.localPath) > -1);
      if (not_added.length > 0) {
        await this.fireHook('md_new', not_added.map(file => file.localPath));
      }

      const modified = documents.filter(doc => status.modified.indexOf(doc.localPath) > -1);
      const now = +new Date();
      if (modified.length > 0) {
        const to_update = modified.filter(file => {
          const fileTs = +new Date(file.modifiedTime);
          const minutesAgo = (now - fileTs) / 1000 / 60;
          return minutesAgo > this.gitUpdateMinutesDelay;
        });

        if (to_update.length > 0) {
          await this.fireHook('md_update', to_update.map(file => file.localPath));
        }
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
