import {assert} from 'chai';
import winston from 'winston';
import fs from 'fs';
import {rmSync, unlinkSync} from 'node:fs';
import path from 'path';
import {execSync} from 'child_process';

import {instrumentLogger} from '../../src/utils/logger/logger.ts';
import {GitScanner} from '../../src/git/GitScanner.ts';
import {createTmpDir} from '../utils.ts';

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

describe('GitTest', function () {
  this.timeout(5000);

  it('test initialize', async () => {
    const localRepoDir: string = createTmpDir();
    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);

      assert.equal(await scannerLocal.isRepo(), false);

      await scannerLocal.initialize();

      assert.equal(await scannerLocal.isRepo(), true);

      {
        const files = fs.readdirSync(scannerLocal.rootPath);
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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
      }

      const commitId = await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md'], [], COMMITER1);
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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');

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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'line1\nline2\nline3\nline4\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'testdel.md'), 'garbage\n');

      await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md', 'testdel.md'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'line1\nline2 modified\nline4\nline5\n');
      fs.mkdirSync(path.join(scannerLocal.rootPath, 'test2.assets'));
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.assets', 'img1.txt'), 'image\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'newone\n');
      fs.unlinkSync(path.join(scannerLocal.rootPath, 'testdel.md'));

      const r1 = await scannerLocal.diff('test222.md');
      assert.equal(r1.length, 0);

      const r2 = await scannerLocal.diff('');
      assert.equal(r2.length, 4);
      assert.equal(r2[0].oldFile, 'test1.md');
      assert.equal(r2[0].newFile, 'test1.md');

      const txt = r2[0].txt.trim().split('\n');

      assert.equal(txt[0], 'test1.md test1.md');
      assert.equal(txt[txt.length - 6], ' line1');
      assert.equal(txt[txt.length - 5], '-line2');
      assert.equal(txt[txt.length - 4], '-line3');
      assert.equal(txt[txt.length - 3], '+line2 modified');
      assert.equal(txt[txt.length - 2], ' line4');
      assert.equal(txt[txt.length - 1], '+line5');

      assert.equal(r2[1].oldFile, 'test2.md');
      assert.equal(r2[1].newFile, 'test2.md');
      const txt2 = r2[1].txt.trim().split('\n');
      assert.equal(txt2[txt2.length - 1], '+newone');

      assert.equal(r2[2].oldFile, 'test2.assets/img1.txt');
      assert.equal(r2[2].newFile, 'test2.assets/img1.txt');
      const txt3 = r2[2].txt.trim().split('\n');
      assert.equal(txt3[txt3.length - 1], '+image');

      assert.equal(r2[3].oldFile, 'testdel.md');
      assert.equal(r2[3].newFile, 'testdel.md');
      const txt4 = r2[3].txt.trim().split('\n');
      assert.equal(txt4[txt4.length - 1], '-garbage');
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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'wikigdrive: aaa\nline2\nline3\nline4\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'wikigdrive: aaa\nversion:\nlastAuthor:\n');

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
      }

      await scannerLocal.autoCommit();

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 1);
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test autoCommit huge', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      await scannerLocal.commit('initial commit', ['.gitignore'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'wikigdrive: aaa\nline2\nline3\nline4\n');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'wikigdrive: aaa\nversion:\nlastAuthor:\n');

      const writeStream = fs.createWriteStream(path.join(scannerLocal.rootPath, 'test_huge.md'));
      for (let i = 0; i < 100000; i++) {
        writeStream.write('1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890\n');
      }
      writeStream.close();

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 3);
      }

      await scannerLocal.autoCommit();

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 2);
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

      fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'Initial content');

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

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'Initial content');
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
      await scannerSecond.setRemoteUrl(githubRepoDir);

      // fs.mkdirSync(path.join(secondRepoDir, 'content'));
      // fs.writeFileSync(path.join(secondRepoDir, '_errors.md'), '---\ntype: \'page\'\n---\nChange local');

      await scannerSecond.resetToRemote('main');
      // await scannerSecond.pullBranch('main');

      const history = await scannerSecond.history('/');
      assert.equal(history.length, 1);
      assert.equal(history[0].author_name, 'John <john@example.tld>');

      {
        fs.writeFileSync(path.join(localRepoDir, 'file2.md'), 'Second change');
        const changes = await scannerLocal.changes();
        assert.equal(1, (await scannerLocal.changes()).length);
        await scannerLocal.commit('Second commit', changes.map(change => change.path), [], COMMITER2);
      }

      await scannerLocal.pushBranch('main');

      {
        // fs.writeFileSync(path.join(localRepoDir, '_errors1.md'), 'Change local');
        // const changes = await scannerLocal.changes();
        // assert.equal(1, (await scannerLocal.changes()).length);
        // await scannerLocal.commit('Local commit', changes.map(change => change.path), [], COMMITER1);
      }

      const fd = fs.openSync(path.join(secondRepoDir, '_errors.md'), 'w');
      // fs.writeSync(fd, '');

      // fs.writeFileSync(path.join(secondRepoDir, '_errors.md'), '');
      // await scannerSecond.cmd('add -N _errors.md');
      // fs.chmodSync(path.join(secondRepoDir, '_errors.md'), 0o771);


      await scannerSecond.autoCommit();

      console.info(await scannerSecond.cmd('ls-files --stage'));

      fs.writeSync(fd, 'test');
      // fs.closeSync(fd);

      console.info(await scannerSecond.cmd('ls-files --stage'));

      // fs.unlinkSync(path.join(secondRepoDir, '_errors.md'));
      // fs.writeFileSync(path.join(secondRepoDir, '_errors.md'), '---\ntype: \'page\'\n---\nChange local');

      // await scannerSecond.autoCommit();

      // fs.writeFileSync(path.join(secondRepoDir, 'untracked.md'), 'untracked');

      console.info(await scannerSecond.cmd('ls-files --stage'));

      await scannerSecond.resetToLocal();
      await scannerSecond.pullBranch('main');

      console.info(await scannerSecond.cmd('status'));

      {
        const history = await scannerSecond.history('/');
        assert.equal(history.length, 2);
        assert.equal(history[0].author_name, 'Bob <bob@example.tld>');
        assert.equal(history[1].author_name, 'John <john@example.tld>');
      }
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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.md'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.md'], [], COMMITER1);

      const history = await scannerLocal.history('/', 'main');
      assert.equal(history.length, 3);
      assert.equal(history[0].author_name, 'John <john@example.tld>');
      assert.equal(history[0].message.trim(), 'Third commit');
      assert.equal(history[0].head, true);
      assert.equal(history[0].remote, false);

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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.md'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.md'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'unstaged.md'), 'unstaged');

      {
        const stats = await scannerLocal.getStats({ remote_branch: 'main' });
        assert.equal(stats.initialized, true);
        assert.equal(stats.headAhead, 1);
        assert.equal(stats.unstaged, 1);
        assert.equal(stats.remote_branch, 'main');
        assert.equal(stats.remote_url, await scannerSecond.getRemoteUrl());
      }

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Another mod');
      await scannerLocal.commit('Third commit', ['file1.md'], [], COMMITER1);

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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.md'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.md'], [], COMMITER1);

      const headCommit = await scannerLocal.getBranchCommit('HEAD');
      const masterCommit = await scannerLocal.getBranchCommit('main');
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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

      await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], [], COMMITER1);

      await scannerLocal.setRemoteUrl(githubRepoDir);
      await scannerLocal.pushBranch('main');

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
      await scannerSecond.commit('Second commit', ['file1.md'], [], COMMITER2);

      await scannerSecond.pushBranch('main');
      await scannerLocal.pullBranch('main');

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
      await scannerLocal.commit('Third commit', ['file1.md'], [], COMMITER1);

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

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.md'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_del.md'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_rename.md'), 'test');

      await scannerLocal.commit('initial commit', ['.gitignore', 'test_mod.md', 'test_del.md', 'test_rename.md'], [], COMMITER1);

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_new.md'), 'test');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.md'), 'mod');
      fs.unlinkSync(path.join(scannerLocal.rootPath, 'test_del.md'));
      fs.renameSync(path.join(scannerLocal.rootPath, 'test_rename.md'), path.join(scannerLocal.rootPath, 'test_renamed.md'));

      {
        const changes = await scannerLocal.changes();
        assert.equal(changes.length, 5);

        {
          const change = changes.find(item => item.path === 'test_new.md');
          assert.equal(change.state.isNew, true);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_del.md');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, true);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_rename.md');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, true);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_renamed.md');
          assert.equal(change.state.isNew, true);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, false);
        }
        {
          const change = changes.find(item => item.path === 'test_mod.md');
          assert.equal(change.state.isNew, false);
          assert.equal(change.state.isDeleted, false);
          assert.equal(change.state.isModified, true);
        }
      }
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

  it('test remove assets', async () => {
    const localRepoDir: string = createTmpDir();

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      const commit = async (filePaths = [], removeFilePaths = []) => {
        const fileAssetsPaths = [];
        for (const filePath of filePaths.filter(path => path.endsWith('.md'))) {
          const assetsPath = filePath.substring(0, filePath.length - 3) + '.assets';
          if (fs.existsSync(path.join(scannerLocal.rootPath, assetsPath))) {
            fileAssetsPaths.push(assetsPath);
          }
        }
        const removeFileAssetsPaths = [];
        for (const fileToRemove of removeFilePaths
          .filter(filePath => filePath.endsWith('.md'))
          .map(filePath => filePath.substring(0, filePath.length - 3) + '.assets')) {

          removeFileAssetsPaths.push(fileToRemove);
        }

        filePaths.push(...fileAssetsPaths);
        removeFilePaths.push(...removeFileAssetsPaths);

        await scannerLocal.commit('initial commit', filePaths, removeFilePaths, COMMITER1);
      };

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.md'), 'test');
      fs.mkdirSync(path.join(scannerLocal.rootPath, 'test.assets'));

      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '1.png'), '1');
      fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '2.png'), '2');

      {
        const changes = await scannerLocal.changes({ includeAssets: true });
        assert.equal(changes.length, 4);
        assert.ok(!!changes.find(item => item.path === '.gitignore'));
        assert.ok(!!changes.find(item => item.path === 'test.md'));
        assert.ok(!!changes.find(item => item.path === 'test.assets/1.png'));
        assert.ok(!!changes.find(item => item.path === 'test.assets/2.png'));
      }

      await commit(['.gitignore', 'test.md'], []);

      {
        const changes = await scannerLocal.changes({ includeAssets: true });
        assert.equal(changes.length, 0);
      }

      unlinkSync(path.join(scannerLocal.rootPath, 'test.md'));
      rmSync(path.join(scannerLocal.rootPath, 'test.assets'), { recursive: true, force: true });

      {
        const changes = await scannerLocal.changes({ includeAssets: true });
        assert.equal(changes.length, 3);
        assert.ok(!!changes.find(item => item.path === 'test.md'));
        assert.ok(!!changes.find(item => item.path === 'test.assets/1.png'));
        assert.ok(!!changes.find(item => item.path === 'test.assets/2.png'));
      }

      await commit([], ['test.md']);

      {
        const changes = await scannerLocal.changes({ includeAssets: true });
        assert.equal(changes.length, 0);
      }

    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
    }
  });

});
