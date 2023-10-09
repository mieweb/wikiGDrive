'use strict';

import minimist from 'minimist';
import dotenv from 'dotenv';
import {fileURLToPath} from 'url';

import {createLogger} from '../utils/logger/logger';
import {loadRunningInstance} from '../containers/server/loadRunningInstance';
import {usage} from './usage';

const __filename = fileURLToPath(import.meta.url);

process.env.GIT_SHA = process.env.GIT_SHA || 'dev';

dotenv.config();
const argv = minimist(process.argv.slice(2));

if (argv._.length < 1 || argv.h || argv.help) {
  await usage(__filename);
  process.exit(0);
}

// PWD is null on Windows, so we can set it here
process.env.PWD = process.cwd();

const workdir = argv['workdir'] || process.env.WIKIGDRIVE_WORKDIR || '/data';

const logger = createLogger(workdir);

const instance = await loadRunningInstance();
if (!instance) {
  logger.error('WikiGDrive server is not running');
  process.exit(1);
}

const response = await fetch(`http://localhost:${instance.port}/api/ps`);
const json = await response.json();

console.table(json);
