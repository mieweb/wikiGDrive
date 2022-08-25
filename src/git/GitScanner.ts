import fs from 'fs';
import path from 'path';

import NodeGit from 'nodegit';
import {StatusFile} from 'nodegit/status-file';
const { Cred, Remote, Repository, Revwalk, Signature, Merge, Status, Diff } = NodeGit;

export interface GitChange {
  path: string;
  state: {
    isNew: boolean;
    isModified: boolean;
    isDeleted: boolean;
    isRenamed: boolean;
  };
}

export class GitScanner {

  constructor(private rootPath: string, private email: string) {
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

  async pullBranch(branch, {publicKey, privateKey, passphrase}) {
    const repo = await Repository.open(this.rootPath);

    await repo.fetch('origin', {
      callbacks: {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
        }
      }
    });

    const remoteBranch = 'refs/remotes/origin/' + branch;

    const headCommit = await repo.getHeadCommit();
    // const headCommit = await repo.getReferenceCommit('refs/heads/master');
    try {
      const remoteCommit = await repo.getReferenceCommit(remoteBranch);

      if (!headCommit) {
        await repo.createBranch('refs/heads/master', remoteCommit);
        await repo.mergeBranches('refs/heads/master', remoteBranch);
        const commit = await repo.getReferenceCommit(remoteBranch);
        await NodeGit.Reset.reset(repo, commit, NodeGit.Reset.TYPE.HARD, {});
        return;
      }

      const index = await Merge.commits(repo, headCommit, remoteCommit, {
        fileFavor: Merge.FILE_FAVOR.OURS
      });

      if (!index.hasConflicts()) {
        const oid = await index.writeTreeTo(repo);
        const committer = Signature.now('WikiGDrive', this.email);
        await repo.createCommit(remoteBranch, committer, committer, 'Merge remote repo', oid, [remoteCommit, headCommit]);
        const commit = await repo.getReferenceCommit(remoteBranch);
        await NodeGit.Reset.reset(repo, commit, NodeGit.Reset.TYPE.HARD, {});
      }
    } catch (err) {
      if (NodeGit.Error.CODE.ENOTFOUND !== err.errno) {
        throw err;
      }
    }
  }

  async pushBranch(branch, {publicKey, privateKey, passphrase}) {
    const repo = await Repository.open(this.rootPath);

    await repo.fetch('origin', {
      callbacks: {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
        }
      }
    });

    const headCommit = await repo.getHeadCommit();
    // const headCommit = await repo.getReferenceCommit('refs/heads/master');
    try {
      const remoteCommit = await repo.getReferenceCommit('refs/remotes/origin/' + branch);
      const index = await Merge.commits(repo, headCommit, remoteCommit, {
        fileFavor: Merge.FILE_FAVOR.OURS
      });

      if (!index.hasConflicts()) {
        const oid = await index.writeTreeTo(repo);
        const committer = Signature.now('WikiGDrive', this.email);
        await repo.createCommit('refs/remotes/origin/' + branch, committer, committer, 'Merge remote repo', oid, [remoteCommit, headCommit]);
        const commit = await repo.getReferenceCommit('refs/remotes/origin/' + branch);
        await NodeGit.Reset.reset(repo, commit, NodeGit.Reset.TYPE.HARD, {});
      }
    } catch (err) {
      if (NodeGit.Error.CODE.ENOTFOUND !== err.errno) {
        throw err;
      }
    }

    const origin = await repo.getRemote('origin');
    const refs = ['refs/heads/master:refs/heads/' + branch];
    await origin.push(refs, {
      callbacks: {
        credentials: (url, username) => {
          return Cred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
        }
      }
    });
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
    const ignorePath = path.join(this.rootPath, '.gitignore');
    if (!fs.existsSync(ignorePath)) {
      fs.writeFileSync(ignorePath, '.private\n.git.json\n.wgd-directory.yaml\n.wgd-local-links.csv\n.wgd-local-log.csv\n*.debug.xml\n');
    }
    if (!await this.isRepo()) {
      await Repository.init(this.rootPath, 0);
    }
  }
}
