import process from 'node:process';

import minimist from 'minimist';
import dotenv from 'dotenv';

import {createLogger} from '../utils/logger/logger.ts';
import {loadRunningInstance} from '../containers/server/loadRunningInstance.ts';
import {urlToFolderId} from '../utils/idParsers.ts';
import {usage} from './usage.ts';

const __filename = import.meta.filename;

process.env.GIT_SHA = process.env.GIT_SHA || 'dev';

dotenv.config();
const argv = minimist(process.argv.slice(2));

if (argv._.length < 1 || argv.h || argv.help) {
  await usage(__filename);
  process.exit(0);
}

// PWD is null on Windows, so we can set it here
process.env.PWD = process.cwd();

const workdir = argv['workdir'] || process.env.VOLUME_DATA || '/data';
const args = argv._.slice(1);

const logger = createLogger(workdir);

const folderId = urlToFolderId(args[0]);
if (!folderId) {
  throw new Error('No folderId');
}

const instance = await loadRunningInstance();
if (!instance) {
  logger.error('WikiGDrive server is not running');
  process.exit(1);
}

const response = await fetch(`http://localhost:${instance.port}/api/inspect/${folderId}`);
const json = await response.json();

console.log(json);
