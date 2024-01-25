'use strict';

import path from 'path';
import minimist from 'minimist';
import dotenv from 'dotenv';
import {fileURLToPath} from 'url';

import {addTelemetry} from '../telemetry';
import {GoogleApiContainer} from '../containers/google_api/GoogleApiContainer';
import {getAuthConfig} from './getAuthConfig';
import {usage} from './usage';
import {initEngine} from './initEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const {mainFileService, containerEngine} = await initEngine(workdir);

  const params = {
    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,
    service_account: argv['service_account'] || null,
  };
  const authConfig = await getAuthConfig(params, mainFileService);

  const apiContainer = new GoogleApiContainer({ name: 'google_api' }, authConfig);
  await apiContainer.mount(await mainFileService);
  await containerEngine.registerContainer(apiContainer);
  await apiContainer.run();

  const drives = await apiContainer.listDrives();
  console.log('Available drives:');
  console.table(drives);

  containerEngine.flushData();
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
