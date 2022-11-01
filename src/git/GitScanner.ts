import fs from 'fs';
import path from 'path';

import {Logger} from 'winston';
import {UserConfig} from '../containers/google_folder/UserConfigService';
import {exec} from 'child_process';

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

  private exec(command: string, opts: ExecOpts = { env: {}, skipLogger: false }): Promise<{ stdout: string, stderr: string }> {
    const err = new Error();
    const stackList = err.stack.split('\n');

    return new Promise((resolve, reject) => {
      if (!opts.skipLogger) {
        this.logger.info(command);
      }

      exec(command, { cwd: this.rootPath, env: opts.env }, (error, stdout, stderr) => {
        if (stdout) {
          if (!opts.skipLogger) {
            this.logger.info(stdout);
          }
        }
        if (stderr) {
          if (!opts.skipLogger) {
            this.logger.error(stderr);
          }
        }
        if (error) {
          const err = new Error(error.message);
          err.stack = stackList.slice(0, 1).concat(stackList.slice(2)).join('\n');
          return reject(err);
        }

        resolve({
          stdout, stderr
        });
      });
    });
  }

  async isRepo() {
    try {
      await this.exec('git status', { skipLogger: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  async changes(): Promise<GitChange[]> {
    const retVal = [];

    const result = await this.exec('git status', { skipLogger: true });
    let mode = 0;

    for (const line of result.stdout.split('\n')) {
      if (line.trim().startsWith('(use ')) {
        continue;
      }

      switch (mode) {
        case 0:
          if (line.startsWith('Untracked files:')) {
            mode = 1;
          }
          if (line.startsWith('Changes not staged for commit:')) {
            mode = 2;
          }
          break;
        case 1:
          if (line.trim().length === 0) {
            mode = 0;
            break;
          }

          retVal.push({
            path: line.trim(),
            state: {
              isNew: true,
              isDeleted: false,
              isModified: false
            }
          });
          break;
        case 2:
          if (line.trim().length === 0) {
            mode = 0;
            break;
          }

          if (line.trim().startsWith('deleted:')) {
            retVal.push({
              path: line.trim().substring('deleted:'.length).trim(),
              state: {
                isNew: false,
                isDeleted: true,
                isModified: false
              }
            });
          } else
          if (line.trim().startsWith('modified:')) {
            retVal.push({
              path: line.trim().substring('modified:'.length).trim(),
              state: {
                isNew: false,
                isDeleted: false,
                isModified: true
              }
            });
          } else
          if (line.trim().startsWith('new file:')) {
            retVal.push({
              path: line.trim().substring('new file:'.length).trim(),
              state: {
                isNew: true,
                isDeleted: false,
                isModified: false
              }
            });
          }
          break;
      }
    }
    return retVal;
  }

  async commit(message: string, addedFiles: string[], removedFiles: string[], committer): Promise<string> {
    addedFiles = addedFiles.map(fileName => fileName.startsWith('/') ? fileName.substring(1) : fileName)
      .filter(fileName => !! fileName);
    removedFiles = removedFiles.map(fileName => fileName.startsWith('/') ? fileName.substring(1) : fileName)
      .filter(fileName => !! fileName);


    for (const fileName of addedFiles) {
      await this.exec(`git add "${sanitize(fileName)}"`, { skipLogger: true });
    }
    for (const fileName of removedFiles) {
      await this.exec(`git rm "${sanitize(fileName)}"`, { skipLogger: true });
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

  async pushBranch(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
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
            if (line.startsWith('@@ ') && line.endsWith(' @@')) {
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

              const parts = line.substring(3, line.length-3).split(' ');
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
              if (line.startsWith('@@ ') && line.endsWith(' @@')) {
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
      return [];
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
    const patches = await this.diff('/');

    const dontCommit = new Set<string>();
    const toCommit = new Set<string>();

    for (const patch of patches) {
      const item = {
        oldFile: patch.oldFile,
        newFile: patch.newFile,
        txt: '',
      };

      for (const line of patch.txt.split('\n')) {
        if ('-' !== line.substring(0, 1) && '+' !== line.substring(0, 1)) {
          continue;
        }
        item.txt += line.substring(1) + '\n';
      }

      const txtWithoutVersion = item.txt
        .split('\n')
        .filter(line => !!line)
        .filter(line => !line.startsWith('wikigdrive:') && !line.startsWith('version:') && !line.startsWith('lastAuthor:'))
        .join('\n')
        .trim();

      if (txtWithoutVersion.length === 0 && item.txt.length > 0 && patch.oldFile === patch.newFile) {
        toCommit.add(patch.newFile);
      } else {
        dontCommit.add(patch.oldFile);
        dontCommit.add(patch.newFile);
      }
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

  async getStats(userConfig: UserConfig) {
    let initialized: boolean;
    let headAhead = 0;
    let unstaged = 0;

    try {
      if (userConfig.remote_branch) {
        const result = await this.exec(`git rev-list --left-right --count master...origin/${userConfig.remote_branch}`, {
          skipLogger: true
        });
        const parts = result.stdout.split(' ');
        headAhead = parseInt(parts[0]) || 0;
      }
      // eslint-disable-next-line no-empty
    } catch (ignore) {}

    try {
      const result = await this.exec('git status', { skipLogger: true });

      let mode = 0;
      for (const line of result.stdout.split('\n')) {
        if (line.startsWith('Your branch is ahead of')) {
          const idx = line.indexOf(' by ');
          headAhead = parseInt(line.substring(idx + ' by '.length).split(' ')[0]) || 0;
        }

        switch (mode) {
          case 0:
            if (line.startsWith('Untracked files:')) {
              mode = 1;
            }
            if (line.startsWith('Changes not staged for commit:')) {
              mode = 2;
            }
            break;
          case 1:
            if (line.trim().startsWith('(use "git add ')) {
              break;
            }

            if (!line.trim()) {
              mode = 0;
              break;
            }

            unstaged++;
            break;
          case 2:
            if (line.trim().length === 0) {
              mode = 0;
              break;
            }

            if (line.trim().startsWith('modified:')) {
              unstaged++;
            } else
            if (line.trim().startsWith('new file:')) {
              unstaged++;
            }
            break;
        }
      }

      initialized = true;
    } catch (err) {
      initialized = false;
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
