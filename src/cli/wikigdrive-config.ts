import process from 'node:process';

import minimist from 'minimist';
import dotenv from 'dotenv';

import {addTelemetry} from '../telemetry.ts';
import {FileContentService} from '../utils/FileContentService.ts';
import {getAuthConfig} from './getAuthConfig.ts';
import {usage} from './usage.ts';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

process.env.GIT_SHA = process.env.GIT_SHA || 'dev';

dotenv.config();
await addTelemetry(process.env.ZIPKIN_SERVICE || 'wikigdrive', __dirname);

async function main() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length < 1 || argv.h || argv.help) {
    await usage(__filename);
    process.exit(0);
  }

  // PWD is null on Windows, so we can set it here
  process.env.PWD = process.cwd();

  const workdir = argv['workdir'] || process.env.VOLUME_DATA || '/data';

  const mainFileService = new FileContentService(workdir);
  await mainFileService.mkdir('/');

  const params = {
    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,
    service_account: argv['service_account'] || null,
  };

  const authConfig = await getAuthConfig(params, mainFileService);
  await mainFileService.writeJson('auth_config.json', authConfig);
}

try {
  await main();
  process.exit(0);
} catch (err) {
  if (err.isUsageError) {
    console.error(err.message);
    await usage(__filename);
  } else {
    console.error(err);
  }
  process.exit(1);
}
