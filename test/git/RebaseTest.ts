import {GitScanner} from '../../src/git/GitScanner';
import winston from 'winston';
import {createTmpDir} from '../utils';
import fs from 'fs';
import path from 'path';
import {assert} from 'chai';
import {execSync} from 'child_process';
import {instrumentLogger} from '../../src/utils/logger/logger';

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

describe('RebaseTest', () => {

  it('test clone', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    execSync(`git init -b main --bare ${githubRepoDir}`);

    try {
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

      ////

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      {
        const files = fs.readdirSync(scannerSecond.rootPath);
        assert.equal(3, files.length);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
        assert.ok(files.includes('file1.txt'));
      }

      const headCommit = await scannerLocal.getBranchCommit('HEAD');
      const masterCommit = await scannerLocal.getBranchCommit('master');
      const remoteCommit = await scannerLocal.getBranchCommit('refs/remotes/origin/main');
      assert.equal(headCommit, masterCommit);
      assert.equal(headCommit, remoteCommit);

    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test fast forward', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    execSync(`git init -b main --bare ${githubRepoDir}`);

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');
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

      ////

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      {
        fs.writeFileSync(path.join(secondRepoDir, 'file1.txt'), 'Change on second repo');
        const changes = await scannerSecond.changes();
        assert.equal(1, (await scannerSecond.changes()).length);
        await scannerSecond.commit('Change on second repo', changes.map(change => change.path), [], COMMITER2);
        await scannerSecond.pushBranch('main');
      }

      await scannerLocal.pullBranch('main');

      {
        const history = await scannerLocal.history('');

        const files = fs.readdirSync(scannerLocal.rootPath);
/*
        assert.equal(3, files.length);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
        assert.ok(files.includes('file1.txt'));
*/
      }

      const headCommit = await scannerLocal.getBranchCommit('HEAD');
      const masterCommit = await scannerLocal.getBranchCommit('master');
      const remoteCommit = await scannerLocal.getBranchCommit('refs/remotes/origin/main');
      assert.equal(headCommit, masterCommit);
      assert.equal(headCommit, remoteCommit);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test local fast forward', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    execSync(`git init -b main --bare ${githubRepoDir}`);

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');
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

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Change on local repo');
        const changes = await scannerLocal.changes();
        assert.equal(1, (await scannerLocal.changes()).length);
        await scannerLocal.commit('Change on local repo', changes.map(change => change.path), [], COMMITER1);
        await scannerLocal.pushBranch('main');
      }

      await scannerSecond.pullBranch('main');

      {
        const history = await scannerSecond.history('');

        const files = fs.readdirSync(scannerSecond.rootPath);
        /*
                assert.equal(3, files.length);
                assert.ok(files.includes('.git'));
                assert.ok(files.includes('.gitignore'));
                assert.ok(files.includes('file1.txt'));
        */
      }

      const headCommit = await scannerSecond.getBranchCommit('HEAD');
      const masterCommit = await scannerSecond.getBranchCommit('master');
      const remoteCommit = await scannerSecond.getBranchCommit('refs/remotes/origin/main');
      assert.equal(headCommit, masterCommit);
      assert.equal(headCommit, remoteCommit);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test non conflict', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    execSync(`git init -b main --bare ${githubRepoDir}`);

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');
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

      ////

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      {
        fs.writeFileSync(path.join(secondRepoDir, 'file2.txt'), 'Change on second repo');
        const changes = await scannerSecond.changes();
        assert.equal(1, (await scannerSecond.changes()).length);
        await scannerSecond.commit('Change on second repo', changes.map(change => change.path), [], COMMITER2);
        logger.info('Push second');
        await scannerSecond.pushBranch('main');
        logger.info('Pushed second');
      }

      {
        const history = await scannerSecond.history('');
        assert.equal(2, history.length);

        const files = fs.readdirSync(scannerSecond.rootPath);
        assert.equal(4, files.length);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
        assert.ok(files.includes('file1.txt'));
        assert.ok(files.includes('file2.txt'));
      }

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Change on local repo');
        const changes = await scannerLocal.changes();
        assert.equal(1, (await scannerLocal.changes()).length);
        await scannerLocal.commit('Change on local repo', changes.map(change => change.path), [], COMMITER1);
        logger.info('Push local');
        await scannerLocal.pushBranch('main');
        logger.info('Pushed local');
      }

      await scannerSecond.pullBranch('main');

      {
        const history = await scannerSecond.history('');
        assert.equal(3, history.length);

        const files = fs.readdirSync(scannerSecond.rootPath);
        assert.equal(4, files.length);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
        assert.ok(files.includes('file1.txt'));
        assert.ok(files.includes('file2.txt'));
      }

      const headCommit = await scannerSecond.getBranchCommit('HEAD');
      const masterCommit = await scannerSecond.getBranchCommit('master');
      const remoteCommit = await scannerSecond.getBranchCommit('refs/remotes/origin/main');
      assert.equal(headCommit, masterCommit);
      assert.equal(headCommit, remoteCommit);
    } finally {
      // fs.rmSync(localRepoDir, { recursive: true, force: true });
      // fs.rmSync(githubRepoDir, { recursive: true, force: true });
      // fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

  it('test conflict', async () => {
    const localRepoDir: string = createTmpDir();
    const githubRepoDir: string = createTmpDir();
    const secondRepoDir: string = createTmpDir();

    execSync(`git init -b main --bare ${githubRepoDir}`);

    try {
      const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
      await scannerLocal.initialize();

      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Initial content');
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

      ////

      const scannerSecond = new GitScanner(logger, secondRepoDir, COMMITER2.email);
      await scannerSecond.initialize();
      fs.unlinkSync(secondRepoDir + '/.gitignore');
      await scannerSecond.setRemoteUrl(githubRepoDir);
      await scannerSecond.pullBranch('main');

      {
        fs.writeFileSync(path.join(secondRepoDir, 'file1.txt'), 'Change on second repo');
        const changes = await scannerSecond.changes();
        assert.equal(1, (await scannerSecond.changes()).length);
        await scannerSecond.commit('Change on second repo', changes.map(change => change.path), [], COMMITER2);
        await scannerSecond.pushBranch('main');
      }
      {
        fs.writeFileSync(path.join(localRepoDir, 'file1.txt'), 'Change on local repo');
        const changes = await scannerLocal.changes();
        assert.equal(1, (await scannerLocal.changes()).length);
        await scannerLocal.commit('Change on local repo', changes.map(change => change.path), [], COMMITER1);
        try {
          await scannerLocal.pushBranch('main');
          assert.ok(false, 'Should fail because of conflict');
        } catch (err) {
          if (err.message.indexOf('conflict') === -1) {
            console.error(err);
            assert.fail(err);
          }
          assert.ok(err.message.indexOf('conflict') > -1);
        }
      }

      await scannerLocal.resetToRemote('main');

      await scannerLocal.pushBranch('main');

      {
        const headCommit = await scannerLocal.getBranchCommit('HEAD');
        const masterCommit = await scannerLocal.getBranchCommit('master');
        const remoteCommit = await scannerLocal.getBranchCommit('refs/remotes/origin/main');
        assert.equal(headCommit, masterCommit);
        assert.equal(headCommit, remoteCommit);
      }

      {
        const history = await scannerLocal.history('');

        console.log('historyhistory', history);

        assert.equal(2, history.length);
        assert.equal('Change on second repo', history[0].message);

        const files = fs.readdirSync(scannerLocal.rootPath);
        assert.equal(3, files.length);
        assert.ok(files.includes('.git'));
        assert.ok(files.includes('.gitignore'));
        assert.ok(files.includes('file1.txt'));
      }

      const headCommit = await scannerSecond.getBranchCommit('HEAD');
      const masterCommit = await scannerSecond.getBranchCommit('master');
      const remoteCommit = await scannerSecond.getBranchCommit('refs/remotes/origin/main');
      assert.equal(headCommit, masterCommit);
      assert.equal(headCommit, remoteCommit);
    } finally {
      fs.rmSync(localRepoDir, { recursive: true, force: true });
      fs.rmSync(githubRepoDir, { recursive: true, force: true });
      fs.rmSync(secondRepoDir, { recursive: true, force: true });
    }
  });

});
