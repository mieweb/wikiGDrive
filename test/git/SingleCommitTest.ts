import {createTmpDir} from '../utils.ts';
import {GitScanner} from '../../src/git/GitScanner.ts';
import fs from 'node:fs';
import path from 'node:path';

import test from '../tester.ts';
import winston from 'winston';
import {instrumentLogger} from '../../src/utils/logger/logger.ts';
import Sandbox from '@nyariv/sandboxjs';

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

test('test single commit', async (t) => {
  t.timeout(5000);

  const localRepoDir: string = createTmpDir();

  try {
    const scannerLocal = new GitScanner(logger, localRepoDir, COMMITER1.email);
    await scannerLocal.initialize();

    fs.writeFileSync(path.join(scannerLocal.rootPath, 'test1.md'), 'test');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'navigation.md'), 'nav');
    fs.writeFileSync(path.join(scannerLocal.rootPath, 'toc.md'), 'toc');

    {
      const changes = await scannerLocal.changes();
      t.is(changes.length, 4);
    }

    // console.log('Sandbox', Sandbox);
    const sandbox = new Sandbox.default();
    const exec = sandbox.compileExpression('return (filePath.endsWith(".md") && filePath == "test1.md" && ["navigation.md", "toc.md"]) || []');

    scannerLocal.setCompanionFileResolver((filePath: string) => {
      return exec({ filePath }).run();
    });

    await scannerLocal.commit('initial commit', ['.gitignore', 'test1.md'], COMMITER1);

    const changes = await scannerLocal.changes();
    t.is(changes.length, 0);
  } finally {
    fs.rmSync(localRepoDir, { recursive: true, force: true });
  }
});
