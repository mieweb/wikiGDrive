import {assert} from 'chai';
import winston from 'winston';
import {instrumentLogger} from '../../src/utils/logger/logger';
import {GitScanner} from '../../src/git/GitScanner';
import {createTmpDir} from '../utils';
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';

const COMMITER1 = {
  name: 'John', email: 'john@example.tld'
};

const COMMITER2 = {
  name: 'Bob', email: 'bob@example.tld'
};

const logger = winston.createLogger({
  level: 'debug',
  defaultMeta: {},
  transports: [
    new winston.transports.Console()
  ]
});
instrumentLogger(logger);

describe('GitTest', () => {

  it('test initialize', async () => {
    const localRepoDir: string = createTmpDir();
    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);

      assert.equal(await scannerLocal.isRepo(), false);

      await scannerLocal.initialize();

      assert.equal(await scannerLocal.isRepo(), true);

      {
        const files = fs.readdirSync(scannerLocal.rootPath);
        // console.log(files);
        assert.equal(files.length, 2);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
      }

      const changes = await scannerLocal.changes();
      assert.equal(changes.length, 1);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test commit', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.txt'), 'test');

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
      }

      const commitId = await scannerLocal.commit('initial commit', ['.gitignore', 'test1.txt'], [], COMMITER1);
      assert.equal(commitId.length, 40);

      const changes = await scannerLocal.changes();
      assert.equal(changes.length, 0);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test removeUntracked', async () => {
    const localRepoDir: string = createTmpDir();
    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.txt'), 'test');

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
      }

      await scannerLocal.commit('initial commit', ['.gitignore'], [], COMMITER1);

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 1);
      }

      await scannerLocal.removeUntracked();

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 0);
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test getRemoteUrl', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      assert.equal(await scannerLocal.getRemoteUrl(), null);

      await scannerLocal.setRemoteUrl('/tmp/test');

      assert.equal(await scannerLocal.getRemoteUrl(), '/tmp/test');
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test diff', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.txt'), 'line1\nline2\nline3\nline4\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'testdel.txt'), 'garbage\n');

      await scannerLocal.commit('initial commit', ['.gitignore', 'test1.txt', 'testdel.txt'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.txt'), 'line1\nline2 modified\nline4\nline5\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.txt'), 'newone\n');
      fs.unlinkSync(path.join(scannerLocal.rootPath, 'testdel.txt'));

      const r1 = await scannerLocal.diff('test222.txt');
      assert.equal(r1.length, 0);

      const r2 = await scannerLocal.diff('');
      assert.equal(r2.length, 3);
      assert.equal(r2[0].oldFile, 'test1.txt');
      assert.equal(r2[0].newFile, 'test1.txt');

      const txt = r2[0].txt.trim().split('\n');

      assert.equal(txt[0], 'test1.txt test1.txt');
      assert.equal(txt[txt.length - 6], ' line1');
      assert.equal(txt[txt.length - 5], '-line2');
      assert.equal(txt[txt.length - 4], '-line3');
      assert.equal(txt[txt.length - 3], '+line2 modified');
      assert.equal(txt[txt.length - 2], ' line4');
      assert.equal(txt[txt.length - 1], '+line5');

      assert.equal(r2[1].oldFile, 'test2.txt');
      assert.equal(r2[1].newFile, 'test2.txt');
      const txt2 = r2[1].txt.trim().split('\n');
      assert.equal(txt2[txt2.length - 1], '+newone');

      assert.equal(r2[2].oldFile, 'testdel.txt');
      assert.equal(r2[2].newFile, 'testdel.txt');
      const txt3 = r2[2].txt.trim().split('\n');
      assert.equal(txt3[txt3.length - 1], '-garbage');
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test autoCommit', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      await scannerLocal.commit('initial commit', ['.gitignore'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.txt'), 'wikigdrive: aaa\nline2\nline3\nline4\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.txt'), 'wikigdrive: aaa\nversion:\nlastAuthor:\n');

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
      }

      await scannerLocal.autoCommit();

      {
        const changes = await scannerLocal.changes();
        console.log(changes);
        assert.equal(changes.length, 1);
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('pushBranch', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');

      {
        const changes = await scannerLocal.changes();
        assert.equal(2, (await scannerLocal.changes()).length);
        await scannerLocal.commit('First commit', changes.map(change => change.path), [], COMMITER1);
      }

      {
        const changes = await scannerLocal.changes();
        assert.equal(0, changes.length);
      }

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      {
        const scannerGithub = new GitScanner(logger, githubRepoDir, COMMITER1.email);
        const history = await scannerGithub.history('');
        assert.equal(history.length, 1);
        assert.equal(history[0].author_name, 'John <john@example.tld>');
      }

    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('pullBranch', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');

      {
        const changes = await scannerLocal.changes();
        assert.equal(2, (await scannerLocal.changes()).length);
        await scannerLocal.commit('First commit', changes.map(change => change.path), [], COMMITER1);
      }

      {
        const changes = await scannerLocal.changes();
        assert.equal(0, changes.length);
      }

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      const history = await scannerSecond.history('/');
      assert.equal(history.length, 1);
      assert.equal(history[0].author_name, 'John <john@example.tld>');
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test history', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.txt'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.txt'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.txt'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.txt'], [], COMMITER1);

      const history = await scannerLocal.history('/', 'main');
      assert.equal(history.length, 3);
      assert.equal(history[0].author_name, 'John <john@example.tld>');
      assert.equal(history[0].message.trim(), 'Third commit');
      assert.equal(history[0].head, true);
      assert.equal(history[0].remote, false);

      console.log('mmm', await scannerSecond.getBranchCommit('master'));
      console.log('hhh', history[1]);

      assert.equal(history[1].author_name, 'Bob <bob@example.tld>');
      assert.equal(history[1].message.trim(), 'Second commit');
      assert.equal(history[1].head, false);
      assert.equal(history[1].remote, true);

      assert.equal(history[2].author_name, 'John <john@example.tld>');
      assert.equal(history[2].message.trim(), 'First commit');
      assert.equal(history[2].head, false);
      assert.equal(history[2].remote, false);


    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test getStats', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);

      {
        const stats = await scannerLocal.getStats({remote_branch: 'main'});
        assert.equal(stats.initialized, false);
      }

      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.txt'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.txt'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.txt'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.txt'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'unstaged.txt'), 'unstaged');

      {
        const stats = await scannerLocal.getStats({ remote_branch: 'main' });
        console.log(stats);
        assert.equal(stats.initialized, true);
        assert.equal(stats.headAhead, 1);
        assert.equal(stats.unstaged, 1);
        assert.equal(stats.remote_branch, 'main');
        assert.equal(stats.remote_url, await scannerSecond.getRemoteUrl());
      }

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Another mod');
      await scannerLocal.commit('Third commit', ['file1.txt'], [], COMMITER1);

      {
        const stats = await scannerLocal.getStats({ remote_branch: 'main' });
        assert.equal(stats.headAhead, 2);
      }

    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test getBranchCommit', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.txt'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.txt'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.txt'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.txt'], [], COMMITER1);

      const headCommit = await scannerLocal.getBranchCommit('HEAD');
      const masterCommit = await scannerLocal.getBranchCommit('master');
      const remoteCommit = await scannerLocal.getBranchCommit('refs/remotes/origin/main');
      const remoteCommit2 = await scannerSecond.getBranchCommit('HEAD');

      assert.equal(headCommit, masterCommit);
      assert.equal(remoteCommit2, remoteCommit);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test reset', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    try {
      execSync(`git init -b main --bare ${githubRepoDir}`);

      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.txt'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.txt'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.txt'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.txt'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.txt'], [], COMMITER1);

      {
        const history = await scannerLocal.history('');
        assert.equal(history.length, 3);
      }

      await scannerLocal.resetToLocal();
      {
        const history = await scannerLocal.history('');
        assert.equal(history.length, 3);
      }

      await scannerLocal.resetToRemote('main');
      {
        const history = await scannerLocal.history('');
        assert.equal(history.length, 2);
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test changes', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.txt'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_del.txt'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_rename.txt'), 'test');

      await scannerLocal.commit('initial commit', ['.gitignore', 'test_mod.txt', 'test_del.txt', 'test_rename.txt'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_new.txt'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.txt'), 'mod');
      fs.unlinkSync(path.join(scannerLocal.rootPath, 'test_del.txt'));
      fs.renameSync(path.join(scannerLocal.rootPath, 'test_rename.txt'), path.join(scannerLocal.rootPath, 'test_renamed.txt'));

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 5);

        {
          const change = changes.find(item => item.path === 'test_new.txt');
          assert.equal(change.state.isNew, true);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_del.txt');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, true);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_rename.txt');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, true);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_renamed.txt');
          assert.equal(change.state.isNew, true);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_mod.txt');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, true);
        }
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

});
