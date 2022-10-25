import fs from 'fs';
import path from 'path';

import {Logger} from 'winston';
import {StatusFile} from 'nodegit/status-file';
import NodeGit from 'nodegit';
const { Cred, Remote, Repository, Revwalk, Signature, Diff, Reset } = NodeGit;
import {rebaseBranches} from './rebaseBranches';
import {UserConfig} from '../containers/google_folder/UserConfigService';
import {Commit} from 'nodegit/commit';

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

export function wrapErrorSync<T>(asyncFunc: () => T): T {
  try {
    return asyncFunc();
  } catch (errMsg) {
    if (errMsg && errMsg.errorFunction) {
      const err = new Error(errMsg.message);
      const stackList = err.stack.split('\n');
      err.stack = stackList.slice(0, 1).concat(stackList.slice(3)).join('\n');
      for (const k in errMsg) {
        err[k] = errMsg[k];
      }
      throw err;
    }
    throw errMsg;
  }
}

export async function wrapError<T>(asyncFunc: () => T): Promise<T> {
  try {
    return await asyncFunc();
  } catch (errMsg) {
    if (errMsg && errMsg.errorFunction) {
      const err = new Error(errMsg.message);
      const stackList = err.stack.split('\n');
      err.stack = stackList.slice(0, 1).concat(stackList.slice(3)).join('\n');
      for (const k in errMsg) {
        err[k] = errMsg[k];
      }
      throw err;
    }
    throw errMsg;
  }
}

export class GitScanner {

  constructor(private logger: Logger, public readonly rootPath: string, private email: string) {
  }

  async isRepo() {
    try {
      await wrapError(async () => await Repository.open(this.rootPath));
      return true;
    } catch (err) {
      return false;
    }
  }

  async changes(): Promise<GitChange[]> {
    const repo = await wrapError(async () => await Repository.open(this.rootPath));

    const status: StatusFile[] = await wrapError(async () => await repo.getStatus());
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

    const repo = await wrapError(async () => await Repository.open(this.rootPath));
    const index = await wrapError(async () => await repo.refreshIndex());

    for (let fileName of addedFiles) {
      if (fileName.startsWith('/')) {
        fileName = fileName.substring(1);
      }
      if (fileName) {
        await wrapError(async () => await index.addByPath(fileName));
      }
    }
    for (let fileName of removedFiles) {
      if (fileName.startsWith('/')) {
        fileName = fileName.substring(1);
      }
      if (fileName) {
        await wrapError(async () => await index.removeByPath(fileName));
      }
    }

    await wrapError(async () => await index.write());

    const oid = await wrapError(async () => await index.writeTree());
    const parent = await wrapError(async () => await repo.getHeadCommit());

    const parents = [];
    if (parent) {
      parents.push(parent);
    }

    const author = Signature.now(committer.name, committer.email);

    const commitId = await wrapError(async () => await repo.createCommit('HEAD', author, author, message, oid, parents));

    return commitId.tostrS();
  }

  async pullBranch(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }

    const committer = Signature.now('WikiGDrive', this.email);
    const remoteBranchRef = 'refs/remotes/origin/' + remoteBranch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git pull from: ${remoteUrl}#${remoteBranch}`);

    const repo = await wrapError(async () => await Repository.open(this.rootPath));

    this.logger.info('git fetch origin');

    await wrapError(async () => await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    }));

    const headCommit = await wrapError(async () => await repo.getHeadCommit());

    this.logger.info('git head commit: ' + (headCommit ? headCommit.id().tostrS() : 'none'));

    try {
      const remoteCommit = await wrapError(async () => await repo.getReferenceCommit(remoteBranchRef));

      await this.resetToLocal();

      this.logger.info('git remote commit: ' + (remoteCommit ? remoteCommit.id().tostrS() : 'none'));

      if (!headCommit) {
        const reference = await wrapError(async () => await repo.createBranch('master', remoteCommit));
        await wrapError(async () => await repo.checkoutBranch(reference));

        const commitToReset = await wrapError(async () => await repo.getReferenceCommit(remoteBranchRef));
        await wrapError(async () => await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {}));
        return;
      }

      try {
        this.logger.info(`git rebasing branch: master, upstream: ${remoteBranchRef}, onto master`);
        await rebaseBranches(this.logger, repo, 'master', remoteBranchRef, remoteBranchRef, committer, null);
      } catch (err) {
        if (NodeGit.Error.CODE.ECONFLICT === err.errno) {
          this.logger.error('Conflict');
          // await NodeGit.Reset.reset(repo, commit, NodeGit.Reset.TYPE.HARD, {});
          // TODO reset
        }
        throw err;
      }

    } catch (err) {
      this.logger.error(err.stack ? err.stack : err.message);
      throw err;
    }
  }

  async pushBranch(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }

    const committer = Signature.now('WikiGDrive', this.email);
    const remoteBranchRef = 'refs/remotes/origin/' + remoteBranch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git push to: ${remoteUrl}#${remoteBranch}`);

    const repo = await wrapError(async () => await Repository.open(this.rootPath));

    this.logger.info('git fetch origin');

    await wrapError(async () => await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    }));

    const headCommit = await wrapError(async () => await repo.getHeadCommit());

    this.logger.info('git head commit: ' + (headCommit ? headCommit.id().tostrS() : 'none'));

    try {
      const remoteCommit = await wrapError(async () => await repo.getReferenceCommit('refs/remotes/origin/' + remoteBranch));

      this.logger.info('git remote commit: ' + (remoteCommit ? remoteCommit.id().tostrS() : 'none'));

      if (!headCommit) {
        const reference = await wrapError(async () => await repo.createBranch('master', remoteCommit));
        repo.checkoutBranch(reference);

        const commitToReset = await wrapError(async () => await repo.getReferenceCommit(remoteBranchRef));
        await wrapError(async () => await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {}));
        return;
      }

      try {
        this.logger.info(`git rebasing branch: master, upstream: ${remoteBranchRef}, onto master`);
        await rebaseBranches(this.logger, repo, 'master', remoteBranchRef, remoteBranchRef, committer, null);
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
      // Ignore pull error if remote not found
    }

    const origin = await wrapError(async () => await repo.getRemote('origin'));
    const refs = ['refs/heads/master:refs/heads/' + remoteBranch];
    await wrapError(async () => await origin.push(refs, {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    }));
  }

  async resetToLocal() {
    this.logger.info('git reset local');

    const repo = await wrapError(async () => await Repository.open(this.rootPath));
    const commitToReset = await wrapError(async () => await repo.getHeadCommit());
    if (commitToReset) {
      await wrapError(async () => await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {}));
    }
  }

  async resetToRemote(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'master';
    }
    const remoteBranchRef = 'refs/remotes/origin/' + remoteBranch;

    const remoteUrl = await this.getRemoteUrl();
    this.logger.info(`git reset on remote: ${remoteUrl}#${remoteBranch}`);

    const repo = await wrapError(async () => await Repository.open(this.rootPath));

    this.logger.info('git fetch origin');

    await wrapError(async () => await repo.fetch('origin', {
      callbacks: !sshParams ? undefined : {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, sshParams.publicKey, sshParams.privateKey, sshParams.passphrase);
        }
      }
    }));

    const commitToReset = await wrapError(async () => await repo.getReferenceCommit(remoteBranchRef));
    await wrapError(async () => await Reset.reset(repo, commitToReset, Reset.TYPE.HARD, {}));
  }

  async getRemoteUrl(): Promise<string> {
    const repo = await wrapError(async () => await Repository.open(this.rootPath));
    try {
      const origin = await wrapError(async () => await repo.getRemote('origin'));
      return origin.url();
    } catch (e) {
      return null;
    }
  }

  async setRemoteUrl(url) {
    const repo = await wrapError(async () => await Repository.open(this.rootPath));
    try {
      await wrapError(async () => await Remote.delete(repo, 'origin'));
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
    if (url) {
      await wrapError(async () => await Remote.create(repo, 'origin', url));
    }
  }

  async diff(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const repo = await wrapError(async () => await Repository.open(this.rootPath));
      const diff = await wrapError(async () => await Diff.indexToWorkdir(repo, null, {
        pathspec: fileName,
        flags: Diff.OPTION.SHOW_UNTRACKED_CONTENT | Diff.OPTION.RECURSE_UNTRACKED_DIRS
      }));
      const patches = await wrapError(async () => await diff.patches());

      const retVal = [];

      for (const patch of patches) {
        const item = {
          oldFile: patch.oldFile().path(),
          newFile: patch.newFile().path(),
          txt: '',
        };

        const hunks = await wrapError(async () => await patch.hunks());
        for (const hunk of hunks) {
          const lines = await wrapError(async () => await hunk.lines());

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
      this.logger.error(err.stack ? err.stack : err.message);
      return [];
    }
  }

  async history(fileName: string, remoteBranch = '') {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

    try {
      const repo = await wrapError(async () => await Repository.open(this.rootPath));

      const headCommit = await this.getBranchCommit('HEAD');

      let remoteCommit;
      if (remoteBranch) {
        const remoteBranchRef = 'refs/remotes/origin/' + remoteBranch;
        remoteCommit = await this.getBranchCommit(remoteBranchRef);
      }

      const firstCommitOnMaster = await wrapError(async () => repo.getMasterCommit());

      const walker = repo.createRevWalk();
      walker.push(firstCommitOnMaster.id());
      walker.sorting(Revwalk.SORT.TIME);

      const retVal = [];
      if (fileName) {
        const resultingArrayOfCommits = await wrapError(async () => await walker.fileHistoryWalk(fileName, 500));
        for (const entry of resultingArrayOfCommits) {
          const author = entry.commit.author();
          const commitId = entry.commit.id().tostrS();
          const item = {
            date: entry.commit.date(),
            author_name: author.name() + ' <' + author.email() + '>',
            message: entry.commit.message(),
            id: commitId,
            head: headCommit == commitId,
            remote: remoteCommit == commitId
          };
          retVal.push(item);
        }
      } else {
        const resultingArrayOfCommits = await wrapError(async () => await walker.commitWalk(500));

        for (const commit of resultingArrayOfCommits) {
          const author = commit.author();
          const commitId = commit.id().tostrS();
          const item = {
            date: commit.date(),
            author_name: author.name() + ' <' + author.email() + '>',
            message: commit.message(),
            id: commitId,
            head: headCommit == commitId,
            remote: remoteCommit == commitId
          };
          retVal.push(item);
        }
      }

      return retVal;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return [];
      }
      this.logger.error(err.stack ? err.stack : err.message);
      throw err;
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
      await wrapError(async () => await Repository.init(this.rootPath, 0));
    }
  }

  async getBranchCommit(branch: string): Promise<string> {
    try {
      const repo = await wrapError(async () => await Repository.open(this.rootPath));
      const commit = await wrapError(async () => await repo.getBranchCommit(branch));
      if (!commit) {
        return null;
      }
      return commit.id().tostrS();
    } catch (err) {
      return null;
    }
  }

  async autoCommit() {
    try {
      const repo = await wrapError(async () => await Repository.open(this.rootPath));
      const diff = await wrapError(async () => await Diff.indexToWorkdir(repo, null, {
        flags: Diff.OPTION.SHOW_UNTRACKED_CONTENT | Diff.OPTION.RECURSE_UNTRACKED_DIRS
      }));
      const patches = await wrapError(async () => await diff.patches());

      const dontCommit = new Set<string>();
      const toCommit = new Set<string>();

      for (const patch of patches) {
        const item = {
          oldFile: patch.oldFile().path(),
          newFile: patch.newFile().path(),
          txt: '',
        };

        const hunks = await wrapError(async () => await patch.hunks());
        for (const hunk of hunks) {
          const lines = await wrapError(async () => await hunk.lines());

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
      this.logger.error(err.stack ? err.stack : err.message);
    }
  }

  async getStats(userConfig: UserConfig) {
    let initialized = false;
    let headAhead = 0;
    let unstaged = 0;

    try {
      const repo = await wrapError(async () => await Repository.open(this.rootPath));
      initialized = true;

      if (userConfig.remote_branch) {
        try {
          const remoteBranchRef = 'refs/remotes/origin/' + userConfig.remote_branch;

          const headCommit = await wrapError(async () => await NodeGit.AnnotatedCommit.fromRef(repo, await repo.getReference('HEAD')));
          const headCommitId = headCommit.id().tostrS();
          const remoteCommit = await wrapError(async () => await NodeGit.AnnotatedCommit.fromRef(repo, await repo.getReference(remoteBranchRef)));
          const remoteCommitId = remoteCommit.id().tostrS();

          let headIdx = -1;
          let remoteIdx = -1;

          const walker = repo.createRevWalk();
          walker.push(headCommit.id());
          walker.sorting(Revwalk.SORT.REVERSE);
          const commits: Commit[] = await wrapError(async () => await walker.commitWalk(500));
          for (let idx = 0; idx < commits.length; idx++) {
            const commitId = commits[idx].id().tostrS();
            if (commitId === headCommitId) {
              headIdx = idx;
            }
            if (commitId === remoteCommitId) {
              remoteIdx = idx;
            }
            if (headIdx !== -1 && remoteIdx !== 1) {
              headAhead = headIdx - remoteIdx;
              break;
            }
          }
        } catch (err) {
          if (!err.message.startsWith('no reference found for shorthand')) {
            this.logger.warn(err.message);
          }
        }
      }

      const diff = await wrapError(async () => await Diff.indexToWorkdir(repo, null, {
        flags: Diff.OPTION.SHOW_UNTRACKED_CONTENT | Diff.OPTION.RECURSE_UNTRACKED_DIRS
      }));
      const diffStats = await diff.getStats();
      unstaged = diffStats.filesChanged().valueOf();
    } catch (err) { // eslint-disable no-empty
    }

    return {
      initialized,
      headAhead,
      unstaged,
      remote_branch: userConfig.remote_branch,
      remote_url: initialized ? await this.getRemoteUrl() : null
    };
  }
}
