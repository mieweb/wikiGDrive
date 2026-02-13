/* eslint-disable @typescript-eslint/no-unused-vars */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type {Logger} from 'winston';

import {UserConfig} from '../containers/google_folder/UserConfigService.ts';
import {TelemetryMethod} from '../telemetry.ts';

const __filename = import.meta.filename;

export interface GitChange {
  path: string;
  state: {
    isNew: boolean;
    isModified: boolean;
    isDeleted: boolean;
  };
  attachments?: number;
}

interface SshParams {
  privateKeyFile: string;
}

interface Commiter {
  name: string;
  email: string;
}

function sanitize(txt) {
  txt = txt.replace(/[;"|]/g, '');
  return txt;
}

interface ExecOpts {
  env?: {
    [k: string]: string
  };
  skipLogger?: boolean;
  ignoreError?: boolean;
}

export class GitScanner {
  public debug = false;

  private companionFileResolver: (filePath: string) => Promise<string[]> = async () => ([]);

  constructor(private logger: Logger, public readonly rootPath: string, private email: string) {
  }

  @TelemetryMethod({ paramsCount: 1 })
  private async exec(cmd: string, opts: ExecOpts = { env: {}, skipLogger: false, ignoreError: false }): Promise<{ stdout: string, stderr: string }> {
    if (!opts.skipLogger) {
      this.logger.info(cmd, { stackOffset: 1, filename: __filename });
    }

    let [ stdout, stderr ] = [ '', '' ];

    if (!opts.env) {
      opts.env = {};
    }
    if (!opts.env['HOME']) {
      opts.env['HOME'] = process.env.HOME;
    }
    if (!opts.env['PATH']) {
      opts.env['PATH'] = process.env.PATH;
    }

    const command = new Deno.Command('/bin/sh', {
      args: [ '-c', cmd ],
      cwd: this.rootPath,
      env: opts.env,
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = command.spawn();

    const timer = setTimeout(() => {
      this.logger.error('Process timeout', { filename: __filename });
      child.kill();
    }, 300_000);

    const decoder = new TextDecoder();

    const [status] = await Promise.all([
      child.status,
      child.stdout.pipeTo(new WritableStream({
        write: (chunk, controller) => {
          const text = decoder.decode(chunk);
          stdout += text;
          if (!opts.skipLogger) {
            this.logger.info(text, { filename: __filename });
          }
        }
      })),
      child.stderr.pipeTo(new WritableStream({
        write: (chunk, controller) => {
          const text = decoder.decode(chunk);
          stderr += text;
          if (!opts.skipLogger) {
            this.logger.error(text, { filename: __filename });
          }
        }
      }))
    ]);

    clearTimeout(timer);

    if (!status.success && !opts.ignoreError) {
      this.logger.error('Process exited with status: ' + status.code, { filename: __filename });
      throw new Error('Process exited with status: ' + status.code + '\n' + stderr);
    }

    return { stdout, stderr };
  }

  async isRepo() {
    return fs.existsSync(path.join(this.rootPath, '.git'));
  }

  async changes(opts: { includeAssets: boolean } = { includeAssets: false }): Promise<GitChange[]> {
    const retVal: { [path: string]: GitChange & { cnt: number } } = {};

    function addEntry(path, state, attachments = 0) {
      if (!retVal[path]) {
        retVal[path] = {
          cnt: 0,
          path,
          state: {
            isNew: false,
            isDeleted: false,
            isModified: false
          }
        };
      }
      retVal[path].cnt++;
      for (const k in state) {
        retVal[path].state[k] = state[k];
      }
      if (attachments > 0) {
        retVal[path].attachments = (retVal[path].attachments || 0) + attachments;
      }
    }

    try {
      const cmd = !opts.includeAssets ?
        'git --no-pager diff HEAD --name-status -- \':!**/*.assets/*.png\'' :
        'git --no-pager diff HEAD --name-status --';

      const result = await this.exec(cmd, { skipLogger: !this.debug, ignoreError: true });
      for (const line of result.stdout.split('\n')) {
        const parts = line.split(/\s/);
        const path = parts[parts.length - 1].trim();

        if (line.match(/^A\s/)) {
          addEntry(path, { isNew: true });
        }
        if (line.match(/^M\s/)) {
          addEntry(path, { isModified: true });
        }
        if (line.match(/^D\s/)) {
          addEntry(path, { isDeleted: true });
        }
      }
    } catch (err) {
      if (err.message.indexOf('fatal: bad revision') === -1) {
        throw err;
      }
    }

    const untrackedResult = await this.exec(
      'git status --short --untracked-files',
      { skipLogger: true }
    );

    for (const line of untrackedResult.stdout.split('\n')) {
      if (!line.trim()) {
        continue;
      }

      const [status, path] = line
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^"/, '')
        .replace(/"$/, '')
        .split(' ');

      if (path.indexOf('.assets/') > -1 && !opts.includeAssets) {
        const idx = path.indexOf('.assets/');
        const mdPath = path.substring(0, idx) + '.md';
        addEntry(mdPath, { isModified: true }, 1);
        continue;
      }

      if (status === 'D') {
        addEntry(path, { isDeleted: true });
      } else
      if (status === 'M') {
        addEntry(path, { isModified: true });
      } else {
        addEntry(path, { isNew: true });
      }
    }

    const retValArr: GitChange[] = Object.values(retVal);
    retValArr.sort((a, b) => {
      return a.path.localeCompare(b.path);
    });
    return retValArr;
  }

  async resolveCompanionFiles(filePaths: string[]): Promise<string[]> {
    const retVal = [];
    for (const filePath of filePaths) {
      retVal.push(filePath);
      try {
        retVal.push(...(await this.companionFileResolver(filePath) || []));
      } catch (err) {
        this.logger.warn('Error evaluating companion files: ' + err.message, { filename: __filename });
        break;
      }
    }
    return retVal;
  }

  async commit(message: string, selectedFiles: string[], committer: Commiter): Promise<string> {
    selectedFiles = selectedFiles.map(fileName => fileName.startsWith('/') ? fileName.substring(1) : fileName)
      .filter(fileName => !!fileName);

    selectedFiles = await this.resolveCompanionFiles(selectedFiles);

    const addedFiles: string[] = [];
    const removedFiles: string[] = [];

    const changes = await this.changes({ includeAssets: true });
    for (const change of changes) {
      let mdPath = change.path;
      if (mdPath.indexOf('.assets/') > -1) {
        mdPath = mdPath.replace(/.assets\/.*/, '.md');
      }

      if (selectedFiles.includes(mdPath)) {
        if (change.state?.isDeleted) {
          removedFiles.push(change.path);
        } else {
          addedFiles.push(change.path);
        }
      }
    }

    while (addedFiles.length > 0) {
      const chunk = addedFiles.splice(0, 400);
      const addParam = chunk.map(fileName => `"${sanitize(fileName)}"`).join(' ');
      if (addParam) {
        await this.exec(`git add ${addParam}`);
      }
    }

    while (removedFiles.length > 0) {
      const chunk = removedFiles.splice(0, 400);
      const rmParam = chunk.map(fileName => `"${sanitize(fileName)}"`).join(' ');
      if (rmParam) {
        try {
          await this.exec(`git rm -r --ignore-unmatch ${rmParam}`);
        } catch (err) {
          if (err.message.indexOf('did not match any files') === -1) {
            throw err;
          }
        }
      }
    }

    await this.exec(`git commit -m "${sanitize(message)}"`, {
      env: {
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email
      }
    });

    const res = await this.exec('git rev-parse HEAD', { skipLogger: !this.debug });

    return res.stdout.trim();
  }

  async pullBranch(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'main';
    }

    const committer = {
      name: 'WikiGDrive',
      email: this.email
    };

    await this.exec(`git pull --rebase origin ${remoteBranch}`, {
      env: {
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email,
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
      }
    });
  }

  async fetch(sshParams?: SshParams) {
    await this.exec('git fetch', {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
      }
    });
  }

  async pushToDir(dir: string) {
    await this.exec(`git clone ${this.rootPath} ${dir}`, { skipLogger: !this.debug });
  }

  async pushBranch(remoteBranch: string, sshParams?: SshParams, localBranch = 'main') {
    if (!remoteBranch) {
      remoteBranch = 'main';
    }

    if (localBranch !== 'main') {
      await this.exec(`git push --force origin ${localBranch}:${remoteBranch}`, {
        env: {
          GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
        }
      });
      return;
    }

    const committer = {
      name: 'WikiGDrive',
      email: this.email
    };

    try {
      await this.exec(`git push origin main:${remoteBranch}`, {
        env: {
          GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
        }
      });
    } catch (err) {
      if (err.message.indexOf('Updates were rejected because the remote contains work') > -1 ||
        err.message.indexOf('Updates were rejected because a pushed branch tip is behind its remote') > -1) {
        await this.exec(`git fetch origin ${remoteBranch}`, {
          env: {
            GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
          }
        });

        try {
          await this.exec(`git rebase origin/${remoteBranch}`, {
            env: {
              GIT_AUTHOR_NAME: committer.name,
              GIT_AUTHOR_EMAIL: committer.email,
              GIT_COMMITTER_NAME: committer.name,
              GIT_COMMITTER_EMAIL: committer.email
            }
          });
        } catch (err) {
          await this.exec('git rebase --abort', { ignoreError: true });
          if (err.message.indexOf('Resolve all conflicts manually') > -1) {
            this.logger.error('Conflict', { filename: __filename });
          }
          throw err;
        }

        await this.exec(`git push origin main:${remoteBranch}`, {
          env: {
            GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
          }
        });
        return;
      }

      return;
    }
  }

  async resetToLocal(sshParams?: SshParams) {
    await this.exec('git checkout main --force', {});
    try {
      await this.exec('git rebase --abort', { ignoreError: true });
    } catch (ignoredError) { /* empty */ }
    await this.exec('git reset --hard HEAD', {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
      }
    });
    await this.removeUntracked();
  }

  async resetToRemote(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'main';
    }

    await this.exec(`git fetch origin ${remoteBranch}`, {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
      }
    });

    try {
      await this.exec('git rebase --abort', { ignoreError: true });
    } catch (ignoredError) { /* empty */ }

    await this.exec(`git reset --hard origin/${remoteBranch}`, {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
      }
    });
    await this.removeUntracked();
  }

  async getOwnerRepo(): Promise<string> {
    let remoteUrl = await this.getRemoteUrl() || '';

    if (remoteUrl.endsWith('.git')) {
      remoteUrl = remoteUrl.substring(0, remoteUrl.length - 4);
    }
    if (remoteUrl.startsWith('git@github.com:')) {
      remoteUrl = remoteUrl.substring('git@github.com:'.length);
      return remoteUrl;
    }

    return '';
  }

  async getRemoteUrl(): Promise<string> {
    try {
      const result = await this.exec('git remote get-url origin', { skipLogger: !this.debug });
      return result.stdout.trim();
    } catch (e) {
      return null;
    }
  }

  async setRemoteUrl(url: string) {
    try {
      await this.exec('git remote rm origin', { skipLogger: !this.debug, ignoreError: true });
      // deno-lint-ignore no-empty
    } catch (ignore) {}
    await this.exec(`git remote add origin "${sanitize(url)}"`, { skipLogger: false });
  }

  async diff(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const untrackedList = await this.exec('git -c core.quotepath=off ls-files --others --exclude-standard', { skipLogger: !this.debug });

      const list = untrackedList.stdout.trim().split('\n')
        .filter(fileName => !!fileName)
        .filter(fileName => fileName.indexOf('.assets/') === -1);

      let fileNamesStr = '';
      for (const fileName of list) {
        if (fileNamesStr.length > 1000) {
          await this.exec(`git add -N ${fileNamesStr}`);
          fileNamesStr = '';
        }
        fileNamesStr += ' ' + sanitize(fileName);
      }
      if (fileNamesStr.length > 0) {
        await this.exec(`git add -N ${fileNamesStr}`);
      }
      if (fileName === '') {
        await this.exec('git add -N *');
      }

      if (fileName.endsWith('.md')) {
        fileName = fileName.substring(0, fileName.length - '.md'.length) + '.*' + ' ' + fileName.substring(0, fileName.length - '.md'.length) + '.*/*';
      }

      const result = await this.exec(`git diff --minimal ${sanitize(fileName)}`, { skipLogger: !this.debug });

      const retVal = [];

      let mode = 0;
      let current = null;
      let currentPatch = '';
      for (const line of result.stdout.split('\n')) {
        switch (mode) {
          case 0:
            if (line.startsWith('diff --git ')) {
              mode = 1;
              current = {
                oldFile: '',
                newFile: '',
                txt: '',
                patches: []
              };
            }
            break;

          case 1:
            if (line.startsWith('--- a/')) {
              current.oldFile = line.substring('--- a/'.length);
            }
            if (line.startsWith('+++ b/')) {
              current.newFile = line.substring('+++ b/'.length);
            }
            if (line.startsWith('@@ ') && line.lastIndexOf(' @@') > 2) {
              if (currentPatch) {
                current.patches.push(currentPatch);
              }
              currentPatch = '';
              if (!current.oldFile) {
                current.oldFile = current.newFile;
              }
              if (!current.newFile) {
                current.newFile = current.oldFile;
              }

              const parts = line.substring(3, line.lastIndexOf(' @@')).split(' ');
              if (parts.length === 2) {
                current.txt += `${current.oldFile} ${current.newFile}\n`;
                mode = 2;
              }
            }
            break;

          case 2:
            if (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-')) {
              current.txt += line + '\n';
            } else {
              if (line.startsWith('@@ ') && line.lastIndexOf(' @@') > 2) {
                if (currentPatch) {
                  current.patches.push(currentPatch);
                }
                currentPatch = '';
                break;
              }

              mode = 0;
              retVal.push(current);
              current = null;

              if (line.startsWith('diff --git ')) {
                mode = 1;
                current = {
                  oldFile: '',
                  newFile: '',
                  txt: ''
                };
              }
            }
            break;
        }
      }

      if (current) {
        if (currentPatch) {
          current.patches.push(currentPatch);
        }
        retVal.push(current);
      }

      retVal.sort((a, b) => {
        if (a.newFile.endsWith('.md') && b.newFile.startsWith(a.newFile.replace('.md', '.assets/'))) {
          return -1;
        }
        if (b.newFile.endsWith('.md') && a.newFile.startsWith(b.newFile.replace('.md', '.assets/'))) {
          return 1;
        }
        return a.newFile.localeCompare(b.newFile);
      });

      return retVal;
    } catch (err) {
      if (err.message.indexOf('fatal: bad revision') > -1) {
        return [];
      }
      if (err.message.indexOf('unknown revision or path not in the working tree.') > -1) {
        return [];
      }
      throw err;
    }
  }

  async history(fileName: string, remoteBranch = '') {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const result = await this.exec(
        `git log --source --pretty="commit %H%d\n\nAuthor: %an <%ae>\nDate: %ct\n\n%B\n" ${sanitize(fileName)}`,
        { skipLogger: !this.debug, ignoreError: true }
      );

      let remoteCommit;
      if (remoteBranch) {
        const remoteBranchRef = 'origin/' + remoteBranch;
        remoteCommit = await this.getBranchCommit(remoteBranchRef);
      }

      const createCommit = (line) => {
        const parts = line.substring('commit '.length).split(' ');
        return {
          id: parts[0],
          author_name: '',
          message: '',
          date: null,
          head: parts.length > 1 && parts[1].startsWith('(HEAD'),
          remote: remoteCommit === parts[0]
        };
      };

      const retVal = [];
      let currentCommit = null;
      let mode = 0;
      for (const line of result.stdout.split('\n')) {
        switch (mode) {
          case 0:
            if (line.startsWith('commit ')) {
              mode = 1;
              currentCommit = createCommit(line);
            }
            break;
          case 1:
            if (line.startsWith('Author: ')) {
              mode = 2;
              currentCommit.author_name = line.substring('Author: '.length).trim();
            }
            break;
          case 2:
            if (line.startsWith('Date: ')) {
              mode = 3;
              currentCommit.date = new Date(1000 * parseInt(line.substring('Date: '.length).trim()));
            }
            break;
          case 3:
            if (line.startsWith('commit ')) {
              mode = 1;
              retVal.push(currentCommit);
              currentCommit = createCommit(line);
              break;
            }

            if (!line.trim()) {
              break;
            }

            currentCommit.message += (currentCommit.message ? '\n' : '') + line.trim();
            break;
        }
      }

      if (currentCommit) {
        retVal.push(currentCommit);
      }

      return retVal;
    } catch (e) {
      return [];
    }
  }

  async initialize() {
    const IGNORED_FILES = [
      '.private',
      'git.json',
      '.wgd-directory.yaml',
      '.wgd-local-links.csv',
      '.wgd-local-log.csv',
      '*.debug.xml',
      '.tree.json'
    ];
    await this.setSafeDirectory();

    const ignorePath = path.join(this.rootPath, '.gitignore');
    const originalIgnore = [];
    if (fs.existsSync(ignorePath)) {
      const originalIgnoreContent = fs.readFileSync(ignorePath).toString();
      originalIgnore.push(...originalIgnoreContent.split('\n'));
    }

    const toIgnore = [...originalIgnore];

    for (const fileName of IGNORED_FILES) {
      if (!originalIgnore.includes(fileName)) {
        toIgnore.push(fileName);
      }
    }

    if (originalIgnore.length !== toIgnore.length) {
      fs.writeFileSync(ignorePath, toIgnore.join('\n') + '\n');
    }

    if (!await this.isRepo()) {
      await this.exec('git init -b main', { skipLogger: !this.debug });
    }
  }

  async setSafeDirectory() {
    await this.exec('git config --global --add safe.directory ' + this.rootPath, { skipLogger: false });
  }

  async getBranchCommit(branch: string): Promise<string> {
    try {
      const res = await this.exec(`git rev-parse ${branch}`, { skipLogger: !this.debug });
      return res.stdout.trim();
    } catch (err) {
      return null;
    }
  }

  async autoCommit() {
    this.logger.info('Auto commit', { filename: __filename });
    const dontCommit = new Set<string>();
    const toCommit = new Set<string>();

    try {
      const untrackedList = await this.exec('git -c core.quotepath=off ls-files --others --exclude-standard', { skipLogger: !this.debug });

      const list = untrackedList.stdout.trim().split('\n')
        .filter(fileName => !!fileName)
        .filter(fileName => fileName.endsWith('.md'));

      let fileNamesStr = '';
      for (const fileName of list) {
        if (fileNamesStr.length > 1000) {
          await this.exec(`git add -N ${fileNamesStr}`);
          fileNamesStr = '';
        }
        fileNamesStr += ' ' + sanitize(fileName);
      }
      if (fileNamesStr.length > 0) {
        await this.exec(`git add -N ${fileNamesStr}`);
      }

      const command = new Deno.Command('/bin/sh', {
        args: [ '-c', 'git diff --minimal --ignore-space-change'],
        cwd: this.rootPath,
        env: {
          HOME: process.env.HOME,
          PATH: process.env.PATH
        },
        stdout: "piped",
        stderr: "piped",
      });

      const childProcess = command.spawn();

      let idx;
      let buff = '';
      let mode = 0;
      let current = null;

      const flushCurrent = (current) => {
        if (current) {
          if (current.doAutoCommit) {
            if (current.oldFile) toCommit.add(current.oldFile);
            if (current.newFile) toCommit.add(current.newFile);
          } else {
            dontCommit.add(current.oldFile);
            dontCommit.add(current.newFile);
          }
        }
        return null;
      };

      const processLine = (line) => {
        switch (mode) {
          case 0:
            if (line.startsWith('diff --git ')) {
              mode = 1;
              current = {
                doAutoCommit: true,
                oldFile: '',
                newFile: ''
              };
              return;
            }
            break;
          case 1:
            if (line.startsWith('--- a/')) {
              current.oldFile = line.substring('--- a/'.length);
            }
            if (line.startsWith('+++ b/')) {
              current.newFile = line.substring('+++ b/'.length);
            }
            if (line.startsWith('@@ ') && line.lastIndexOf(' @@') > 2) {
              const parts = line.substring(3, line.lastIndexOf(' @@')).split(' ');
              if (parts.length === 2) {
                mode = 2;
              }
            }
            break;
          case 2:
            if (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-')) {
              if (line.startsWith('+') || line.startsWith('-')) {
                line = line.substring(1);
                if (!line.startsWith('wikigdrive:') && !line.startsWith('version:') && !line.startsWith('lastAuthor:') && !line.startsWith('date:') &&
                  !line.startsWith('menu:') && !line.startsWith('  main:') &&
                  !line.startsWith('    name:') && !line.startsWith('    identifier:') && !line.startsWith('    weight:') && !line.startsWith('    parent:')
                ) {
                  current.doAutoCommit = false;
                }
              }

            } else {
              if (line.startsWith('@@ ') && line.lastIndexOf(' @@') > 2) {
                break;
              }

              mode = 0;
              current = flushCurrent(current);

              if (line.startsWith('diff --git ')) {
                mode = 1;
                current = {
                  doAutoCommit: true,
                  oldFile: '',
                  newFile: ''
                };
              }
            }
        }
      };

      const decoder = new TextDecoder();
      for await (const chunk of childProcess.stdout) {
        buff += decoder.decode(chunk);

        while ((idx = buff.indexOf('\n')) > -1) {
          const line = buff.substring(0, idx);
          processLine(line);
          buff = buff.substring(idx + 1);
        }
      }

      while ((idx = buff.indexOf('\n')) > -1) {
        const line = buff.substring(0, idx);
        processLine(line);
        buff = buff.substring(idx + 1);
      }

      let error = '';
      for await (const chunk of childProcess.stderr) {
        error += chunk;
      }


      const status = await childProcess.status;

      if (!status.success) {
        const cmd =  'git ' + ['diff', '--minimal', '--ignore-space-change'].join(' ');
        throw new Error( `subprocess (${cmd}) in ${this.rootPath} error exit ${status.code}, ${error}`);
      }

      current = flushCurrent(current);
    } catch (err) {
      this.logger.warn(err.message, { filename: __filename });
    }

    for (const k of dontCommit.values()) {
      toCommit.delete(k);
    }

    if (toCommit.size > 0) {
      this.logger.info(`Auto committing ${toCommit.size} files`, { filename: __filename });
      const addedFiles: string[] = Array.from(toCommit.values());
      const committer = {
        name: 'WikiGDrive',
        email: this.email
      };

      const fileAssetsPaths = [];
      for (const addedFilePath of addedFiles.filter(addedFilePath => addedFilePath.endsWith('.md'))) {
        const assetsPath = addedFilePath.substring(0, addedFilePath.length - 3) + '.assets';
        if (fs.existsSync(path.join(this.rootPath, assetsPath))) {
          fileAssetsPaths.push(assetsPath);
        }
      }
      addedFiles.push(...fileAssetsPaths);

      await this.commit('Auto commit for file version change', addedFiles, committer);
    }
  }

  async countAheadBehind(remoteBranch: string) {
    try {
      const result = await this.exec(`git rev-list --left-right --count HEAD...origin/${remoteBranch}`, {
        skipLogger: !this.debug
      });
      const firstLine = result.stdout.split('\n')[0];

      const [ ahead, behind ] = firstLine.split(/\s+/).map(val => parseInt(val));

      return {
        ahead, behind
      };
      // deno-lint-ignore no-empty
    } catch (ignore) {}

    return { ahead: 0, behind: 0 };
  }

  async getStats(userConfig: UserConfig) {
    let initialized = true;
    const { ahead: headAhead, behind: headBehind } = userConfig.remote_branch ? await this.countAheadBehind(userConfig.remote_branch) : { ahead: 0, behind: 0 };
    let unstaged = 0;

    try {
      const untrackedResult = await this.exec('git status --short --untracked-files', { skipLogger: !this.debug  });
      for (const line of untrackedResult.stdout.split('\n')) {
        if (!line.trim()) {
          continue;
        }
        unstaged++;
      }
    } catch (err) {
      if (err.message.indexOf('fatal: not a git repository')) {
        initialized = false;
      } else {
        throw err;
      }
    }

    try {
      const result = await this.exec('git --no-pager diff HEAD --name-status -- \':!**/*.assets/*.png\'',
        { skipLogger: !this.debug, ignoreError: true });
      for (const line of result.stdout.split('\n')) {
        if (line.match(/^A\s/)) {
          unstaged++;
        }
        if (line.match(/^M\s/)) {
          unstaged++;
        }
      }
    } catch (err) {
      if (!err.message.indexOf('fatal: bad revision')) {
        throw err;
      }
    }

    return {
      initialized,
      headAhead,
      headBehind,
      unstaged,
      remote_branch: userConfig.remote_branch,
      remote_url: initialized ? await this.getRemoteUrl() : null
    };
  }

  async removeUntracked() {
    const result = await this.exec('git -c core.quotepath=off status', { skipLogger: !this.debug });
    let mode = 0;

    const untracked = [];

    for (const line of result.stdout.split('\n')) {
      switch (mode) {
        case 0:
          if (line.startsWith('Untracked files:')) {
            mode = 1;
          }
          break;
        case 1:
          if (line.trim().length === 0) {
            mode = 2;
            break;
          }

          if (line.trim().startsWith('(use ')) {
            break;
          }

          untracked.push(line
            .trim()
            .replace(/^"/, '')
            .replace(/"$/, '')
          );

          break;
      }
    }

    for (const fileName of untracked) {
      const filePath = path.join(this.rootPath, fileName);
      fs.rmSync(filePath, { recursive: true });
    }
  }

  async cmd(cmd: string, arg: string = '') {
    if (!['status', 'remote -v', 'ls-files --stage', 'branch -m'].includes(cmd)) {
      throw new Error('Forbidden command');
    }

    const result = await this.exec('git ' + cmd + ' ' + (arg || ''), { skipLogger: !this.debug });

    return { stdout: result.stdout, stderr: result.stderr };
  }

  async removeCached(filePath: string) {
    await this.exec(`git rm --cached ${filePath}`);
  }

  setCompanionFileResolver(resolver: (filePath: string) => Promise<string[]>) {
    this.companionFileResolver = resolver;
  }

  async stashChanges(): Promise<boolean> {
    try {
      await this.exec('git stash push -u -m "WikiGDrive auto-stash before sync"', { skipLogger: !this.debug });
      return true;
    } catch (err) {
      // If there's nothing to stash, git stash will return "No local changes to save"
      if (err?.message?.includes('No local changes to save')) {
        return false;
      }
      throw err;
    }
  }

  async stashPop(): Promise<void> {
    try {
      await this.exec('git stash pop', { skipLogger: !this.debug });
    } catch (err) {
      // If there's no stash to pop, handle gracefully
      if (err?.message?.includes('No stash entries found')) {
        return;
      }
      throw err;
    }
  }

}
