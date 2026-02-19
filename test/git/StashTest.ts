import fs from 'node:fs';
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
    const stashed = await scannerLocal.stash.stash('Test Stash');
    assertStrictEquals(stashed, true);

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 0);
    }

    // Pop stashed changes
    await scannerLocal.stash.pop();

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
    const stashed = await scannerLocal.stash.stash('Test Stash');
    assertStrictEquals(stashed, true);
    await scannerLocal.pullBranch('main');
    await scannerLocal.stash.pop();

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
