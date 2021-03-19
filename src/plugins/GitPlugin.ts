'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as SimpleGit from 'simple-git/promise';
import { spawn } from 'child_process';

import { BasePlugin } from './BasePlugin';
import { GoogleFiles } from '../storage/GoogleFiles';
import {parseSecondsInterval} from '../utils/parseSecondsInterval';

export class GitPlugin extends BasePlugin {
  private gitUpdateSecondsDelay: number;
  private config_dir: any;
  private dest: string;
  private googleFiles: GoogleFiles;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.gitUpdateSecondsDelay = 3600;

    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;

      const seconds = parseSecondsInterval(params.git_update_delay);
      if (seconds > 0) {
        this.gitUpdateSecondsDelay = seconds;
      }

      if (!fs.existsSync(path.join(params.config_dir, 'hooks'))) {
        fs.mkdirSync(path.join(params.config_dir, 'hooks'), { recursive: true });
      }
      await this.createHookExamples();
    });
    eventBus.on('drive_config:loaded', async (drive_config) => {
      this.dest = drive_config.dest;
    });
    eventBus.on('google_files:initialized', ({ googleFiles }) => {
      this.googleFiles = googleFiles;
    });
    eventBus.on('transform:done', async () => {
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
      const isRepo = await repository.checkIsRepo();
      if (!isRepo) {
        return;
      }
      const status = await repository.status();

      const documents = this.googleFiles.findFiles(file => file.mimeType === GoogleFiles.DOCUMENT_MIME);
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
          const secondsAgo = (now - fileTs) / 1000;
          return secondsAgo > this.gitUpdateSecondsDelay;
        });

        if (to_update.length > 0) {
          await this.fireHook('md_update', to_update.map(file => file.localPath));
        }
      }

    } catch (err) {
      console.error(err);
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
