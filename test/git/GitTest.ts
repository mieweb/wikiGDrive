import fs, {rmSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

import winston from 'winston';
// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

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

Deno.test('test initialize', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();
  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);

    assertStrictEquals(await scannerLocal.isRepo(), false);

    await scannerLocal.initialize();

    assertStrictEquals(await scannerLocal.isRepo(), true);

    {
      const files = fs.readdirSync(scannerLocal.rootPath);
      assertStrictEquals(files.length, 2);
      assertStrictEquals(true, files.includes('.git'));
      assertStrictEquals(true, files.includes('.gitignore'));
    }

    const changes = await scannerLocal.changes();
    assertStrictEquals(changes.length, 1);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test commit', async () => {
  // t.timeout(5000);

  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 2);
    }

    const commitId = await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md'], COMMITER1);
    assertStrictEquals(commitId.length, 40);

    const changes = await scannerLocal.changes();
    assertStrictEquals(changes.length, 0);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test removeUntracked', async () => {
  // t.timeout(5000);

  const localRepoDir: string = createTmpDir();
  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 2);
    }

    await scannerLocal.commit('initial commit', ['.gitignore'], COMMITER1);

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 1);
    }

    await scannerLocal.removeUntracked();

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 0);
    }
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test getRemoteUrl', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    assertStrictEquals(await scannerLocal.getRemoteUrl(), null);

    await scannerLocal.setRemoteUrl('/tmp/test');

    assertStrictEquals(await scannerLocal.getRemoteUrl(), '/tmp/test');
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test diff', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'line1\nline2\nline3\nline4\n');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'testdel.md'), 'garbage\n');

    await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md', 'testdel.md'], COMMITER1);

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'line1\nline2 modified\nline4\nline5\n');
    fs.mkdirSync(path.join(scannerLocal.rootPath, 'test2.assets'));
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.assets', 'img1.txt'), 'image\n');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'newone\n');
    fs.unlinkSync(path.join(scannerLocal.rootPath, 'testdel.md'));

    const r1 = await scannerLocal.diff('test222.md');
    assertStrictEquals(r1.length, 0);

    const r2 = await scannerLocal.diff('');
    assertStrictEquals(r2.length, 4);
    assertStrictEquals(r2[0].oldFile, 'test1.md');
    assertStrictEquals(r2[0].newFile, 'test1.md');

    const txt = r2[0].txt.trim().split('\n');

    assertStrictEquals(txt[0], 'test1.md test1.md');
    assertStrictEquals(txt[txt.length - 6], ' line1');
    assertStrictEquals(txt[txt.length - 5], '-line2');
    assertStrictEquals(txt[txt.length - 4], '-line3');
    assertStrictEquals(txt[txt.length - 3], '+line2 modified');
    assertStrictEquals(txt[txt.length - 2], ' line4');
    assertStrictEquals(txt[txt.length - 1], '+line5');

    assertStrictEquals(r2[1].oldFile, 'test2.md');
    assertStrictEquals(r2[1].newFile, 'test2.md');
    const txt2 = r2[1].txt.trim().split('\n');
    assertStrictEquals(txt2[txt2.length - 1], '+newone');

    assertStrictEquals(r2[2].oldFile, 'test2.assets/img1.txt');
    assertStrictEquals(r2[2].newFile, 'test2.assets/img1.txt');
    const txt3 = r2[2].txt.trim().split('\n');
    assertStrictEquals(txt3[txt3.length - 1], '+image');

    assertStrictEquals(r2[3].oldFile, 'testdel.md');
    assertStrictEquals(r2[3].newFile, 'testdel.md');
    const txt4 = r2[3].txt.trim().split('\n');
    assertStrictEquals(txt4[txt4.length - 1], '-garbage');
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test autoCommit', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    await scannerLocal.commit('initial commit', ['.gitignore'], COMMITER1);

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'wikigdrive: aaa\nline2\nline3\nline4\n');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'wikigdrive: aaa\nversion:\nlastAuthor:\n');

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 2);
    }

    await scannerLocal.autoCommit();

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 1);
    }
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test autoCommit huge', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    await scannerLocal.commit('initial commit', ['.gitignore'], COMMITER1);

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'wikigdrive: aaa\nline2\nline3\nline4\n');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test2.md'), 'wikigdrive: aaa\nversion:\nlastAuthor:\n');

    const writeStream = fs.createWriteStream(path.join(scannerLocal.rootPath, 'test_huge.md'));
    for (let i = 0; i < 100000; i++) {
      writeStream.write('1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890\n');
    }
    writeStream.close();

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 3);
    }

    await scannerLocal.autoCommit();

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 2);
    }
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('pushBranch', async () => {
  // t.timeout(5000);
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
      assertStrictEquals(2, (await scannerLocal.changes()).length);
      await scannerLocal.commit('First commit', changes.map(change => change.path), COMMITER1);
    }

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(0, changes.length);
    }

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    {
      const scannerGithub = new GitScanner(logger, githubRepoDir, COMMITER1.email);
      const history = await scannerGithub.history('');
      assertStrictEquals(history.length, 1);
      assertStrictEquals(history[0].author_name, 'John <john@example.tld>');
    }

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('pullBranch', async () => {
  // t.timeout(5000);

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
      assertStrictEquals(2, (await scannerLocal.changes()).length);
      await scannerLocal.commit('First commit', changes.map(change => change.path), COMMITER1);
    }

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(0, changes.length);
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
    assertStrictEquals(history.length, 1);
    assertStrictEquals(history[0].author_name, 'John <john@example.tld>');

    {
      fs.writeFileSync(path.join(localRepoDir, 'file2.md'), 'Second change');
      const changes = await scannerLocal.changes();
      assertStrictEquals(1, (await scannerLocal.changes()).length);
      await scannerLocal.commit('Second commit', changes.map(change => change.path), COMMITER2);
    }

    await scannerLocal.pushBranch('main');

    {
      // fs.writeFileSync(path.join(localRepoDir, '_errors1.md'), 'Change local');
      // const changes = await scannerLocal.changes();
      // assertStrictEquals(1, (await scannerLocal.changes()).length);
      // await scannerLocal.commit('Local commit', changes.map(change => change.path), COMMITER1);
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
      assertStrictEquals(history.length, 2);
      assertStrictEquals(history[0].author_name, 'Bob <bob@example.tld>');
      assertStrictEquals(history[1].author_name, 'John <john@example.tld>');
    }

    fs.closeSync(fd);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test history', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();
  const githubRepoDir: string = createTmpDir();
  const secondRepoDir: string = createTmpDir();

  try {
    execSync(`git init -b main --bare ${githubRepoDir}`);

    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
    await scannerSecond.initialize();
    fs.unlinkSync(secondRepoDir + '/.gitignore');
    await scannerSecond.setRemoteUrl(githubRepoDir);
    await scannerSecond.pullBranch('main');

    fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
    await scannerSecond.commit('Second commit', ['file1.md'], COMMITER2);

    await scannerSecond.pushBranch('main');
    await scannerLocal.pullBranch('main');

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
    await scannerLocal.commit('Third commit', ['file1.md'], COMMITER1);

    const history = await scannerLocal.history('/', 'main');
    assertStrictEquals(history.length, 3);
    assertStrictEquals(history[0].author_name, 'John <john@example.tld>');
    assertStrictEquals(history[0].message.trim(), 'Third commit');
    assertStrictEquals(history[0].head, true);
    assertStrictEquals(history[0].remote, false);

    assertStrictEquals(history[1].author_name, 'Bob <bob@example.tld>');
    assertStrictEquals(history[1].message.trim(), 'Second commit');
    assertStrictEquals(history[1].head, false);
    assertStrictEquals(history[1].remote, true);

    assertStrictEquals(history[2].author_name, 'John <john@example.tld>');
    assertStrictEquals(history[2].message.trim(), 'First commit');
    assertStrictEquals(history[2].head, false);
    assertStrictEquals(history[2].remote, false);


  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test getStats', async () => {
  // t.timeout(5000);

  const localRepoDir: string = createTmpDir();
  const githubRepoDir: string = createTmpDir();
  const secondRepoDir: string = createTmpDir();

  try {
    execSync(`git init -b main --bare ${githubRepoDir}`);

    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);

    {
      const stats = await scannerLocal.getStats({remote_branch: 'main'});
      assertStrictEquals(stats.initialized, false);
    }

    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
    await scannerSecond.initialize();
    fs.unlinkSync(secondRepoDir + '/.gitignore');
    await scannerSecond.setRemoteUrl(githubRepoDir);
    await scannerSecond.pullBranch('main');

    fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
    await scannerSecond.commit('Second commit', ['file1.md'], COMMITER2);

    await scannerSecond.pushBranch('main');
    await scannerLocal.pullBranch('main');

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
    await scannerLocal.commit('Third commit', ['file1.md'], COMMITER1);

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'unstaged.md'), 'unstaged');

    {
      const stats = await scannerLocal.getStats({ remote_branch: 'main' });
      assertStrictEquals(stats.initialized, true);
      assertStrictEquals(stats.headAhead, 1);
      assertStrictEquals(stats.unstaged, 1);
      assertStrictEquals(stats.remote_branch, 'main');
      assertStrictEquals(stats.remote_url, await scannerSecond.getRemoteUrl());
    }

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Another mod');
    await scannerLocal.commit('Third commit', ['file1.md'], COMMITER1);

    {
      const stats = await scannerLocal.getStats({ remote_branch: 'main' });
      assertStrictEquals(stats.headAhead, 2);
    }

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test getBranchCommit', async () => {
  // t.timeout(5000);

  const localRepoDir: string = createTmpDir();
  const githubRepoDir: string = createTmpDir();
  const secondRepoDir: string = createTmpDir();

  try {
    execSync(`git init -b main --bare ${githubRepoDir}`);

    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
    await scannerSecond.initialize();
    fs.unlinkSync(secondRepoDir + '/.gitignore');
    await scannerSecond.setRemoteUrl(githubRepoDir);
    await scannerSecond.pullBranch('main');

    fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
    await scannerSecond.commit('Second commit', ['file1.md'], COMMITER2);

    await scannerSecond.pushBranch('main');
    await scannerLocal.pullBranch('main');

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
    await scannerLocal.commit('Third commit', ['file1.md'], COMMITER1);

    const headCommit = await scannerLocal.getBranchCommit('HEAD');
    const masterCommit = await scannerLocal.getBranchCommit('main');
    const remoteCommit = await scannerLocal.getBranchCommit('refs/remotes/origin/main');
    const remoteCommit2 = await scannerSecond.getBranchCommit('HEAD');

    assertStrictEquals(headCommit, masterCommit);
    assertStrictEquals(remoteCommit2, remoteCommit);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test reset', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();
  const githubRepoDir: string = createTmpDir();
  const secondRepoDir: string = createTmpDir();

  try {
    execSync(`git init -b main --bare ${githubRepoDir}`);

    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Initial content');

    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
    await scannerSecond.initialize();
    fs.unlinkSync(secondRepoDir + '/.gitignore');
    await scannerSecond.setRemoteUrl(githubRepoDir);
    await scannerSecond.pullBranch('main');

    fs.writeFileSync(path.join(scannerSecond.rootPath, 'file1.md'), 'Mod by second');
    await scannerSecond.commit('Second commit', ['file1.md'], COMMITER2);

    await scannerSecond.pushBranch('main');
    await scannerLocal.pullBranch('main');

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'file1.md'), 'Mod by local');
    await scannerLocal.commit('Third commit', ['file1.md'], COMMITER1);

    {
      const history = await scannerLocal.history('');
      assertStrictEquals(history.length, 3);
    }

    await scannerLocal.resetToLocal();
    {
      const history = await scannerLocal.history('');
      assertStrictEquals(history.length, 3);
    }

    await scannerLocal.resetToRemote('main');
    {
      const history = await scannerLocal.history('');
      assertStrictEquals(history.length, 2);
    }
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test changes', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.md'), 'test');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_del.md'), 'test');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_rename.md'), 'test');

    await scannerLocal.commit('initial commit', ['.gitignore', 'test_mod.md', 'test_del.md', 'test_rename.md'], COMMITER1);

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_new.md'), 'test');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test_mod.md'), 'mod');
    fs.unlinkSync(path.join(scannerLocal.rootPath, 'test_del.md'));
    fs.renameSync(path.join(scannerLocal.rootPath, 'test_rename.md'), path.join(scannerLocal.rootPath, 'test_renamed.md'));

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 5);

      {
        const change = changes.find(item => item.path === 'test_new.md');
        assertStrictEquals(change.state.isNew, true);
        assertStrictEquals(change.state.isDeleted, false);
        assertStrictEquals(change.state.isModified, false);
      }
      {
        const change = changes.find(item => item.path === 'test_del.md');
        assertStrictEquals(change.state.isNew, false);
        assertStrictEquals(change.state.isDeleted, true);
        assertStrictEquals(change.state.isModified, false);
      }
      {
        const change = changes.find(item => item.path === 'test_rename.md');
        assertStrictEquals(change.state.isNew, false);
        assertStrictEquals(change.state.isDeleted, true);
        assertStrictEquals(change.state.isModified, false);
      }
      {
        const change = changes.find(item => item.path === 'test_renamed.md');
        assertStrictEquals(change.state.isNew, true);
        assertStrictEquals(change.state.isDeleted, false);
        assertStrictEquals(change.state.isModified, false);
      }
      {
        const change = changes.find(item => item.path === 'test_mod.md');
        assertStrictEquals(change.state.isNew, false);
        assertStrictEquals(change.state.isDeleted, false);
        assertStrictEquals(change.state.isModified, true);
      }
    }
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test remove assets', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    const commit = async (filePaths = []) => {
      await scannerLocal.commit('initial commit', filePaths, COMMITER1);
    };

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.md'), 'test');
    fs.mkdirSync(path.join(scannerLocal.rootPath, 'test.assets'));

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '1.png'), '1');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '2.png'), '2');

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 4);
      assertStrictEquals(true, !!changes.find(item => item.path === '.gitignore'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.md'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/1.png'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/2.png'));
    }

    await commit(['.gitignore', 'test.md']);

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 0);
    }

    unlinkSync(path.join(scannerLocal.rootPath, 'test.md'));
    rmSync(path.join(scannerLocal.rootPath, 'test.assets'), { recursive: true, force: true });

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 3);
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.md'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/1.png'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/2.png'));
      assertStrictEquals(true, changes.find(item => item.path === 'test.md').state.isDeleted);
      assertStrictEquals(true, changes.find(item => item.path === 'test.assets/1.png').state.isDeleted);
      assertStrictEquals(true, changes.find(item => item.path === 'test.assets/2.png').state.isDeleted);
    }

    await commit(['test.md']);

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 0);
    }

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test remove assets not file', async () => {
  // t.timeout(5000);
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    const commit = async (filePaths = []) => {
      await scannerLocal.commit('initial commit', filePaths, COMMITER1);
    };

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.md'), 'test');
    fs.mkdirSync(path.join(scannerLocal.rootPath, 'test.assets'));

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '1.png'), '1');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.assets', '2.png'), '2');

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 4);
      assertStrictEquals(true, !!changes.find(item => item.path === '.gitignore'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.md'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/1.png'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/2.png'));
    }

    await commit(['.gitignore', 'test.md']);

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 0);
    }

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test.md'), 'renamed');
    rmSync(path.join(scannerLocal.rootPath, 'test.assets'), { recursive: true, force: true });

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 3);
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.md'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/1.png'));
      assertStrictEquals(true, !!changes.find(item => item.path === 'test.assets/2.png'));
      assertStrictEquals(true, changes.find(item => item.path === 'test.md').state.isModified);
      assertStrictEquals(true, changes.find(item => item.path === 'test.assets/1.png').state.isDeleted);
      assertStrictEquals(true, changes.find(item => item.path === 'test.assets/2.png').state.isDeleted);
    }

    await commit(['test.md']);

    {
      const changes = await scannerLocal.changes({ includeAssets: true });
      assertStrictEquals(changes.length, 0);
    }

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test stash and pop', async () => {
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'Initial content');
    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    // Create a local change
    fs.writeFileSync(path.join(localRepoDir, 'file2.md'), 'New file');

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 1);
      assertStrictEquals(changes[0].path, 'file2.md');
    }

    // Stash changes
    const stashed = await scannerLocal.stashChanges();
    assertStrictEquals(stashed, true);

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 0);
    }

    // Pop stashed changes
    await scannerLocal.stashPop();

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 1);
      assertStrictEquals(changes[0].path, 'file2.md');
    }

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test commit with local behind remote', async () => {
  // This test simulates a scenario where WikiGDrive is out of sync with the remote repository:
  // - localRepoDir: Represents the WikiGDrive local repository
  // - githubRepoDir: Represents the remote GitHub repository (bare repo)
  // - secondRepoDir: Represents another contributor who commits directly to GitHub
  // The test verifies that the stash/pull/pop workflow correctly syncs local changes
  // when the local repository is behind the remote.
  
  const localRepoDir: string = createTmpDir();
  const githubRepoDir: string = createTmpDir();
  const secondRepoDir: string = createTmpDir();

  try {
    execSync(`git init -b main --bare ${githubRepoDir}`);

    // Setup first repo (WikiGDrive local repository)
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'Initial content');
    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    await scannerLocal.setRemoteUrl(githubRepoDir);
    await scannerLocal.pushBranch('main');

    // Setup second repo (simulates another contributor pushing to GitHub)
    const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
    await scannerSecond.initialize();
    fs.unlinkSync(secondRepoDir + '/.gitignore');
    await scannerSecond.setRemoteUrl(githubRepoDir);
    await scannerSecond.pullBranch('main');

    fs.writeFileSync(path.join(secondRepoDir, 'file2.md'), 'Second repo change');
    await scannerSecond.commit('Second commit', ['file2.md'], COMMITER2);
    await scannerSecond.pushBranch('main');

    // WikiGDrive repository now has local changes but is behind remote
    fs.writeFileSync(path.join(localRepoDir, 'file3.md'), 'Local change');

    // Fetch to make remote refs available
    await scannerLocal.fetch();

    const { ahead, behind } = await scannerLocal.countAheadBehind('main');
    assertStrictEquals(ahead, 0);
    assertStrictEquals(behind, 1);

    // Test stash, pull, and pop workflow
    const stashed = await scannerLocal.stashChanges();
    assertStrictEquals(stashed, true);
    await scannerLocal.pullBranch('main');
    await scannerLocal.stashPop();

    // Verify we now have both files
    assertStrictEquals(fs.existsSync(path.join(localRepoDir, 'file2.md')), true);
    assertStrictEquals(fs.existsSync(path.join(localRepoDir, 'file3.md')), true);

    // Verify we're now up to date
    const { ahead: newAhead, behind: newBehind } = await scannerLocal.countAheadBehind('main');
    assertStrictEquals(newAhead, 0);
    assertStrictEquals(newBehind, 0);

    // Now we can commit successfully
    await scannerLocal.commit('Third commit', ['file3.md'], COMMITER1);

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
    fs.rmSync(githubRepoDir, { recursive: true, force: true });
    fs.rmSync(secondRepoDir, { recursive: true, force: true });
  }
});

Deno.test('test hasConflicts detection', async () => {
  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'line1\n');
    await scannerLocal.commit('First commit', ['.gitignore', 'file1.md'], COMMITER1);

    // Create a conflict situation
    fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'line1\nline2\n');
    await scannerLocal.commit('Second commit', ['file1.md'], COMMITER1);

    // Reset to previous commit and make conflicting change
    execSync('git reset --hard HEAD~1', { cwd: localRepoDir });
    fs.writeFileSync(path.join(localRepoDir, 'file1.md'), 'line1\ndifferent line\n');
    await scannerLocal.commit('Conflicting commit', ['file1.md'], COMMITER1);

    // Try to merge - this will create a conflict
    try {
      execSync('git merge HEAD@{1}', { cwd: localRepoDir });
    } catch (err) {
      // Expected to fail with conflict
    }

    // Should detect conflicts
    const hasConflicts = await scannerLocal.hasConflicts();
    assertStrictEquals(hasConflicts, true);

  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});
