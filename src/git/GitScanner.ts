import fs from 'fs';
import path from 'path';

import NodeGit from 'nodegit';
import {StatusFile} from 'nodegit/status-file';
const { Cred, Remote, Repository, Revwalk, Signature, Merge } = NodeGit;

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

  async changes(): Promise<any> {
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

  async commit(message: string, fileNames: string[], committer): Promise<string> {
    const repo = await Repository.open(this.rootPath);
    const index = await repo.refreshIndex();

    for (let fileName of fileNames) {
      if (fileName.startsWith('/')) {
        fileName = fileName.substring(1);
      }
      if (fileName) {
        await index.addByPath(fileName);
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
    try {
      const repo = await Repository.open(this.rootPath);

      await repo.fetch('origin', {
        callbacks: {
          credentials: (url, username) => {
            return Cred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
          }
        }
      });

      const headCommit = await repo.getReferenceCommit('refs/heads/master');
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
    } catch (err) {
      console.warn(err.message);
      throw err;
    }
  }

  async pushBranch(branch, {publicKey, privateKey, passphrase}) {
    try {
      const repo = await Repository.open(this.rootPath);

      await repo.fetch('origin', {
        callbacks: {
          credentials: (url, username) => {
            return Cred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
          }
        }
      });

      const headCommit = await repo.getReferenceCommit('refs/heads/master');
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
    } catch (err) {
      console.warn(err.message);
      throw err;
    }
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

  async history(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

/*
    const s = await this.repository.status({
      file: fileName
    });
    console.log('s', s);
*/

    try {
      const repo = await Repository.open(this.rootPath);
      const firstCommitOnMaster = await repo.getMasterCommit();

      const walker = repo.createRevWalk();
      walker.push(firstCommitOnMaster.id());
      walker.sorting(Revwalk.SORT.TIME);

      const retVal = [];
      const resultingArrayOfCommits = await walker.fileHistoryWalk(fileName, 500);
      resultingArrayOfCommits.forEach(function(entry) {
        const author = entry.commit.author();
        const item = {
          date: entry.commit.date(),
          author_name: author.name() + ' <' + author.email() + '>',
          message: entry.commit.message()
        };
        retVal.push(item);
      });

      return retVal;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return [];
      }
      console.error(err.message);
      return [];
    }
  }

  async initialize() {
    if (!await this.isRepo()) {
      fs.writeFileSync(path.join(this.rootPath, '.gitignore'), '.private\n.git.json\n.wgd-directory.yaml\n*.debug.xml\n');
      await Repository.init(this.rootPath, 0);
    }
  }
}
