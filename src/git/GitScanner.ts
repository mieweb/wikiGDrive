import fs from 'fs';
import path from 'path';
import {exec, spawn} from 'child_process';

import {Logger} from 'winston';
import {UserConfig} from '../containers/google_folder/UserConfigService';
import {TelemetryMethod} from '../telemetry';

export interface GitChange {
  path: string;
  state: {
    isNew: boolean;
    isModified: boolean;
    isDeleted: boolean;
  };
}

interface SshParams {
  privateKeyFile: string;
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
}

export class GitScanner {

  constructor(private logger: Logger, public readonly rootPath: string, private email: string) {
  }

  @TelemetryMethod({ paramsCount: 1 })
  private async exec(command: string, opts: ExecOpts = { env: {}, skipLogger: false }): Promise<{ stdout: string, stderr: string }> {
    const err = new Error();
    const stackList = err.stack.split('\n');

    if (!opts.skipLogger) {
      this.logger.info(command, { stackOffset: 1 });
    }

    let [ stdout, stderr ] = [ null, null ];

    try {
      await new Promise((resolve, reject) => {
        exec(command, { cwd: this.rootPath, env: opts.env }, (error, stdoutResult, stderrResult) => {
          stdout = stdoutResult;
          stderr = stderrResult;
          if (error) {
            return reject(error);
          }
          resolve({
            stdout, stderr
          });
        });
      });
      return { stdout, stderr };
    } catch (error) {
      const err = new Error('Failed exec:' + command + '\n' + (error.message)  );
      err.stack = [err.message].concat(stackList.slice(2)).join('\n');
      if (!opts.skipLogger) {
        this.logger.error(err.stack ? err.stack : err.message);
      }
      throw error;
    } finally {
      if (stderr) {
        if (!opts.skipLogger) {
          this.logger.error(stderr);
        }
      }
      if (stdout) {
        if (!opts.skipLogger) {
          this.logger.info(stdout);
        }
      }
    }
  }

  async isRepo() {
    return fs.existsSync(path.join(this.rootPath, '.git'));
  }

  async changes(): Promise<GitChange[]> {
    const retVal = [];

    try {
      const result = await this.exec('git --no-pager diff HEAD --name-status -- \':!**/*.assets/*.png\'', { skipLogger: true });
      for (const line of result.stdout.split('\n')) {
        const parts = line.split(/\s/);
        const path = parts[parts.length - 1];
        if (line.match(/^A\s/)) {
          retVal.push({
            path,
            state: {
              isNew: true,
              isDeleted: false,
              isModified: false
            }
          });
        }
        if (line.match(/^M\s/)) {
          retVal.push({
            path,
            state: {
              isNew: false,
              isDeleted: false,
              isModified: true
            }
          });
        }
        if (line.match(/^D\s/)) {
          retVal.push({
            path,
            state: {
              isNew: false,
              isDeleted: true,
              isModified: false
            }
          });
        }
      }
    } catch (err) {
      if (!err.message.indexOf('fatal: bad revision')) {
        throw err;
      }
    }

    const untrackedResult = await this.exec('git ls-files --others --exclude-standard', { skipLogger: true });
    for (const line of untrackedResult.stdout.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      retVal.push({
        path: line.trim(),
        state: {
          isNew: true,
          isDeleted: false,
          isModified: false
        }
      });
    }

    return retVal;
  }

  async commit(message: string, addedFiles: string[], removedFiles: string[], committer): Promise<string> {
    addedFiles = addedFiles.map(fileName => fileName.startsWith('/') ? fileName.substring(1) : fileName)
      .filter(fileName => !! fileName);
    removedFiles = removedFiles.map(fileName => fileName.startsWith('/') ? fileName.substring(1) : fileName)
      .filter(fileName => !! fileName);

    const addParam = addedFiles.map(fileName => `"${sanitize(fileName)}"`).join(' ');
    const rmParam = removedFiles.map(fileName => `"${sanitize(fileName)}"`).join(' ');
    if (addParam) {
      await this.exec(`git add ${addParam}`);
    }
    if (rmParam) {
      await this.exec(`git rm ${rmParam}`);
    }

    await this.exec(`git commit -m "${sanitize(message)}"`, {
      env: {
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email
      }
    });

    const res = await this.exec('git rev-parse HEAD', { skipLogger: true });

    return res.stdout.trim();
  }

  async pullBranch(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }

    await this.exec(`git pull --rebase origin ${remoteBranch}:master`, {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
      }
    });
  }

  async pushToDir(dir: string, localBranch = 'master') {
    await this.exec(`git clone ${this.rootPath} ${dir}`, { skipLogger: true });
  }

  async pushBranch(remoteBranch: string, sshParams?: SshParams, localBranch = 'master') {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }

    if (localBranch !== 'master') {
      await this.exec(`git push --force origin ${localBranch}:${remoteBranch}`, {
        env: {
          GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
        }
      });
      return;
    }

    const committer = {
      name: 'WikiGDrive',
      email: this.email
    };

    try {
      await this.exec(`git push origin master:${remoteBranch}`, {
        env: {
          GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
        }
      });
    } catch (err) {
      if (err.message.indexOf('Updates were rejected because the remote contains work') > -1 ||
        err.message.indexOf('Updates were rejected because a pushed branch tip is behind its remote') > -1) {
        await this.exec(`git fetch origin ${remoteBranch}`, {
          env: {
            GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
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
          await this.exec('git rebase --abort');
          if (err.message.indexOf('Resolve all conflicts manually') > -1) {
            this.logger.error('Conflict');
          }
          throw err;
        }

        await this.exec(`git push origin master:${remoteBranch}`, {
          env: {
            GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
          }
        });
        return;
      }

      return;
    }
  }

  async resetToLocal() {
    await this.exec('git reset --hard HEAD');
    await this.removeUntracked();
  }

  async resetToRemote(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }

    await this.exec('git fetch origin', {
      env: {
        GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : undefined
      }
    });

    await this.exec(`git reset --hard refs/remotes/origin/${remoteBranch}`);
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
      const result = await this.exec('git remote get-url origin', { skipLogger: true });
      return result.stdout.trim();
    } catch (e) {
      return null;
    }
  }

  async setRemoteUrl(url) {
    try {
      await this.exec('git remote rm origin', { skipLogger: true });
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
    await this.exec(`git remote add origin "${sanitize(url)}"`, { skipLogger: true });
  }

  async diff(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const untrackedList = await this.exec('git ls-files --others --exclude-standard', { skipLogger: true });

      for (const fileName of untrackedList.stdout.trim().split('\n')) {
        if (!fileName) {
          continue;
        }
        await this.exec(`git add -N ${sanitize(fileName)}`);
      }

      const result = await this.exec(`git diff --minimal ${sanitize(fileName)}`, { skipLogger: true });

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
        { skipLogger: true }
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
      await this.exec('git init -b master', { skipLogger: true });
    }
  }

  async getBranchCommit(branch: string): Promise<string> {
    try {
      const res = await this.exec(`git rev-parse ${branch}`, { skipLogger: true });
      return res.stdout.trim();
    } catch (err) {
      return null;
    }
  }

  async autoCommit() {
    const dontCommit = new Set<string>();
    const toCommit = new Set<string>();

    try {
      const untrackedList = await this.exec('git ls-files --others --exclude-standard', { skipLogger: true });

      for (const fileName of untrackedList.stdout.trim().split('\n')) {
        if (!fileName) {
          continue;
        }
        await this.exec(`git add -N ${sanitize(fileName)}`);
      }

      const childProcess = spawn('git',
        ['diff', '--minimal'],
        { cwd: this.rootPath, env: {} });
      const promise = new Promise((resolve, reject) => {
        childProcess.on('close', resolve);
      });

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
                if (!line.startsWith('wikigdrive:') && !line.startsWith('version:') && !line.startsWith('lastAuthor:') && !line.startsWith('date:')) {
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

      for await (const chunk of childProcess.stdout) {
        buff += chunk;

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

      const exitCode = await promise;
      if (exitCode) {
        throw new Error( `subprocess error exit ${exitCode}, ${error}`);
      }

      current = flushCurrent(current);
    } catch (err) {
      this.logger.warn(err.message);
    }

    for (const k of dontCommit.values()) {
      toCommit.delete(k);
    }

    if (toCommit.size > 0) {
      this.logger.info(`Auto committing ${toCommit.size} files`);
      const addedFiles: string[] = Array.from(toCommit.values());
      const committer = {
        name: 'WikiGDrive',
        email: this.email
      };
      await this.commit('Auto commit for file version change', addedFiles, [], committer);
    }
  }

  async countAhead(remoteBranch: string) {
    let retVal = 0;

    try {
      const result = await this.exec(`git log origin/${remoteBranch}..HEAD`, {
        skipLogger: true
      });
      for (const line of result.stdout.split('\n')) {
          if (line.startsWith('commit ')) {
            retVal++;
          }
      }
      // eslint-disable-next-line no-empty
    } catch (ignore) {}

    return retVal;
  }

  async getStats(userConfig: UserConfig) {
    let initialized = true;
    const headAhead = userConfig.remote_branch ? await this.countAhead(userConfig.remote_branch) : 0;
    let unstaged = 0;

    try {
      const untrackedResult = await this.exec('git ls-files --others --exclude-standard', { skipLogger: true });
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
      const result = await this.exec('git --no-pager diff HEAD --name-status -- \':!**/*.assets/*.png\'', { skipLogger: true });
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
      unstaged,
      remote_branch: userConfig.remote_branch,
      remote_url: initialized ? await this.getRemoteUrl() : null
    };
  }

  async removeUntracked() {
    const result = await this.exec('git status', { skipLogger: true });
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

          untracked.push(line.trim());

          break;
      }
    }

    for (const fileName of untracked) {
      const filePath = path.join(this.rootPath, fileName);
      fs.unlinkSync(filePath);
    }
  }
}
