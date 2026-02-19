import fs from 'node:fs';
import path from 'node:path';

import winston from 'winston';
import Sandbox from '@nyariv/sandboxjs';
// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import {createTmpDir} from '../utils.ts';
import {GitScanner} from '../../src/git/GitScanner.ts';
import {instrumentLogger} from '../../src/utils/logger/logger.ts';

const COMMITER1 = {
  name: 'John', email: 'john@example.tld'
};

const logger = winston.createLogger({
  level: 'debug',
  defaultMeta: {},
  transports: [
    new winston.transports.Console()
  ]
});
instrumentLogger(logger);

Deno.test('test single commit', async () => {
  // t.timeout(5000);

  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'navigation.md'), 'nav');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'toc.md'), 'toc');

    {
      const changes = await scannerLocal.changes();
      assertStrictEquals(changes.length, 4);
    }

    // console.log('Sandbox', Sandbox);
    const sandbox = new Sandbox.default();
    const exec = sandbox.compileExpression('return (filePath.endsWith(".md") && filePath == "test1.md" && ["navigation.md", "toc.md"]) || []');

    scannerLocal.setCompanionFileResolver(async (filePath: string) => {
      return exec({ filePath }).run() as string[];
    });

    await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md'], COMMITER1);

    const changes = await scannerLocal.changes();
    assertStrictEquals(changes.length, 0);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});
