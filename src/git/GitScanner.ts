import fs from 'fs';
import path from 'path';

import {Logger} from 'winston';
import {StatusFile} from 'nodegit/status-file';
import NodeGit from 'nodegit';
const { Cred, Remote, Repository, Revwalk, Signature, Diff, Reset } = NodeGit;
import {rebaseBranches} from './rebaseBranches';

export interface GitChange {
  path: string;
  state: {
    isNew: boolean;
    isModified: boolean;
    isDeleted: boolean;
    isRenamed: boolean;
  };
}

interface SshParams {
  publicKey: string;
  privateKey: string;
  passphrase: string;
}

export class GitScanner {

  constructor(private logger: Logger, public readonly rootPath: string, private email: string) {
  }

  async isRepo() {
    try {
      await Repository.open(this.rootPath);
      return true;
    } catch (err) {
      return false;
    }
  }

  async changes(): Promise<GitChange[]> {
    const repo = await Repository.open(this.rootPath);

    const status: StatusFile[] = await repo.getStatus();
    const retVal = [];
    for (const item of status) {
      const row = {
        path: item.path(),
        state: {
          isNew: !!item.isNew(),
          isModified: !!item.isModified(),
          isDeleted: !!item.isDeleted(),
          isRenamed: !!item.isRenamed()
        }
      };
      retVal.push(row);
    }
    return retVal;
  }

  async commit(message: string, addedFiles: string[], removedFiles: string[], committer): Promise<string> {
    this.logger.info(`git commit: ${message}`);

    const repo = await Repository.open(this.rootPath);
    const index = await repo.refreshIndex();

    for (let fileName of addedFiles) {
      if (fileName.startsWith('/')) {
        fileName = fileName.substring(1);
      }
      if (fileName) {
        await index.addByPath(fileName);
      }
    }
    for (let fileName of removedFiles) {
      if (fileName.startsWith('/')) {
        fileName = fileName.substring(1);
      }
      if (fileName) {
        await index.removeByPath(fileName);
      }
    }

    await index.write();

    const oid = await index.writeTree();
    const parent = await repo.getHeadCommit();

    const parents = [];
    if (parent) {
      parents.push(parent);
    }

    const author = Signature.now(committer.name, committer.email);

    const commitId = await repo.createCommit('HEAD', author, author, message, oid, parents);

    return commitId.tostrS();
  }

  async pullBranch(branch, sshParams?: SshParams) {
    const committer = Signature.now('WikiGDrive', this.email);
    const remoteBranch = 'refs/remotes/origin/' + branch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git pull from: ${remoteUrl}#${branch}`);

    const repo = await Repository.open(this.rootPath);

    this.logger.info('git fetch origin');

    await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    });

    const headCommit = await repo.getHeadCommit();

    this.logger.info('git head commit: ' + (headCommit ? headCommit.id().tostrS() : 'none'));

    try {
      const remoteCommit = await repo.getReferenceCommit(remoteBranch);

      this.logger.info('git remote commit: ' + (remoteCommit ? remoteCommit.id().tostrS() : 'none'));

      if (!headCommit) {
        const reference = await repo.createBranch('refs/heads/master', remoteCommit);
        repo.checkoutBranch(reference);

        const commitToReset = await repo.getReferenceCommit(remoteBranch);
        await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {});
        return;
      }

      try {
        this.logger.info(`git rebasing branch: master, upstream: ${remoteBranch}, onto master`);
        await rebaseBranches(this.logger, repo, 'master', remoteBranch, remoteBranch, committer, null);
      } catch (err) {
        if (NodeGit.Error.CODE.ECONFLICT === err.errno) {
          this.logger.error('Conflict');
          // await NodeGit.Reset.reset(repo, commit, NodeGit.Reset.TYPE.HARD, {});
          // TODO reset
        }
        throw err;
      }

    } catch (err) {
      if (NodeGit.Error.CODE.ENOTFOUND !== err.errno) {
        throw err;
      }
    }
  }

  async pushBranch(branch, sshParams?: SshParams) {
    const committer = Signature.now('WikiGDrive', this.email);
    const remoteBranch = 'refs/remotes/origin/' + branch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git push to: ${remoteUrl}#${branch}`);

    const repo = await Repository.open(this.rootPath);

    this.logger.info('git fetch origin');

    await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    });

    const headCommit = await repo.getHeadCommit();

    this.logger.info('git head commit: ' + (headCommit ? headCommit.id().tostrS() : 'none'));

    try {
      const remoteCommit = await repo.getReferenceCommit('refs/remotes/origin/' + branch);

      this.logger.info('git remote commit: ' + (remoteCommit ? remoteCommit.id().tostrS() : 'none'));

      if (!headCommit) {
        const reference = await repo.createBranch('refs/heads/master', remoteCommit);
        repo.checkoutBranch(reference);

        // await repo.mergeBranches('refs/heads/master', remoteBranch);
        const commitToReset = await repo.getReferenceCommit(remoteBranch);
        await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {});
        return;
      }

      try {
        this.logger.info(`git rebasing branch: master, upstream: ${remoteBranch}, onto master`);
        await rebaseBranches(this.logger, repo, 'master', remoteBranch, remoteBranch, committer, null);
      } catch (err) {
        if (NodeGit.Error.CODE.ECONFLICT === err.errno) {
          this.logger.error('Conflict');
        }
        throw err;
      }

    } catch (err) {
      if (NodeGit.Error.CODE.ENOTFOUND !== err.errno) {
        throw err;
      }
    }

    const origin = await repo.getRemote('origin');
    const refs = ['refs/heads/master:refs/heads/' + branch];
    await origin.push(refs, {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    });
  }

  async resetOnRemote(branch: string, sshParams?: SshParams) {
    const remoteBranch = 'refs/remotes/origin/' + branch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git push to: ${remoteUrl}#${branch}`);

    const repo = await Repository.open(this.rootPath);

    this.logger.info('git fetch origin');

    await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    });

    const commitToReset = await repo.getReferenceCommit(remoteBranch);
    await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {});
  }

  async getRemoteUrl(): Promise<string> {
    const repo = await Repository.open(this.rootPath);
    try {
      const origin = await repo.getRemote('origin');
      return origin.url();
    } catch (e) {
      return null;
    }
  }

  async setRemoteUrl(url) {
    const repo = await Repository.open(this.rootPath);
    try {
      await Remote.delete(repo, 'origin');
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
    await Remote.create(repo, 'origin', url);
  }

  async diff(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const repo = await Repository.open(this.rootPath);
      const diff = await Diff.indexToWorkdir(repo, null, {
        pathspec: fileName,
        flags: Diff.OPTION.SHOW_UNTRACKED_CONTENT | Diff.OPTION.RECURSE_UNTRACKED_DIRS
      });
      const patches = await diff.patches();

      const retVal = [];

      for (const patch of patches) {
        const item = {
          oldFile: patch.oldFile().path(),
          newFile: patch.newFile().path(),
          txt: '',
        };

        const hunks = await patch.hunks();
        for (const hunk of hunks) {
          const lines = await hunk.lines();

          item.txt += patch.oldFile().path() + ' ' + patch.newFile().path() + '\n';
          item.txt += hunk.header().trim() + '\n';
          for (const line of lines) {
            item.txt += String.fromCharCode(line.origin()) + line.content();
          }
        }
        retVal.push(item);
      }

      return retVal;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return [];
      }
      return [];
    }
  }

  async history(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const repo = await Repository.open(this.rootPath);
      const firstCommitOnMaster = await repo.getMasterCommit();

      const walker = repo.createRevWalk();
      walker.push(firstCommitOnMaster.id());
      walker.sorting(Revwalk.SORT.TIME);

      const retVal = [];
      if (fileName) {
        const resultingArrayOfCommits = await walker.fileHistoryWalk(fileName, 500);
        for (const entry of resultingArrayOfCommits) {
          const author = entry.commit.author();
          const item = {
            date: entry.commit.date(),
            author_name: author.name() + ' <' + author.email() + '>',
            message: entry.commit.message(),
            id: entry.commit.id().tostrS()
          };
          retVal.push(item);
        }
      } else {
        const resultingArrayOfCommits = await walker.commitWalk(500);

        for (const commit of resultingArrayOfCommits) {
          const author = commit.author();
          const item = {
            date: commit.date(),
            author_name: author.name() + ' <' + author.email() + '>',
            message: commit.message(),
            id: commit.id().tostrS()
          };
          retVal.push(item);
        }
      }

      return retVal;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return [];
      }
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
      fs.writeFileSync(ignorePath, toIgnore.join('\n'));
    }

    if (!await this.isRepo()) {
      await Repository.init(this.rootPath, 0);
    }
  }

  async getBranchCommit(branch: string) {
    const repo = await Repository.open(this.rootPath);
    const commit = await repo.getBranchCommit(branch);
    if (!commit) {
      return null;
    }
    return commit.id().tostrS();
  }

  async autoCommit() {
    try {
      const repo = await Repository.open(this.rootPath);
      const diff = await Diff.indexToWorkdir(repo, null, {
        flags: Diff.OPTION.SHOW_UNTRACKED_CONTENT | Diff.OPTION.RECURSE_UNTRACKED_DIRS
      });
      const patches = await diff.patches();

      const dontCommit = new Set<string>();
      const toCommit = new Set<string>();

      for (const patch of patches) {
        const item = {
          oldFile: patch.oldFile().path(),
          newFile: patch.newFile().path(),
          txt: '',
        };

        const hunks = await patch.hunks();
        for (const hunk of hunks) {
          const lines = await hunk.lines();

          for (const line of lines) {
            if (' ' === String.fromCharCode(line.origin())) {
              continue;
            }
            item.txt += line.content();
          }
        }

        const txtWithoutVersion = item.txt
          .split('\n')
          .filter(line => !!line)
          .filter(line => !line.startsWith('wikigdrive:') && !line.startsWith('version:') && !line.startsWith('lastAuthor:'))
          .join('\n')
          .trim();

        if (txtWithoutVersion.length === 0 && item.txt.length > 0 && patch.oldFile().path() === patch.newFile().path()) {
          toCommit.add(patch.newFile().path());
        } else {
          dontCommit.add(patch.oldFile().path());
          dontCommit.add(patch.newFile().path());
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

      return;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return ;
      }
      this.logger.error(err.message);
    }

  }
}
