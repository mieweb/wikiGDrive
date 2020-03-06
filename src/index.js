'use strict';

import path from 'path';
import minimist from 'minimist';
import { SyncService } from './SyncService';

function usage() {
  console.log(
    `Usage:
    $ wikigdrive [shared drive url]

Options:
    --config (.wikigdrive)
    --client_id
    --client_secret
    --dest (current working folder)
    --watch (keep scanning for changes, ie: daemon)
    --link_mode [mdURLs|dirURLs|uglyURLs]

    --config-reset google_auth # removes google_auth object from .wikidgrive file
    --config-reset fileMap # removes fileMap object from .wikidgrive file
    --config-reset binaryFiles # removes binaryFiles object from .wikidgrive file
    --config-reset-all # leaves empty .wikigdrive file

Examples:
    $ wikigdrive https://google.drive...
    `);
}

async function index() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length !== 1 || argv.h || argv.help) {
    usage();
    process.exit(1);
  }

  const params = {};

  params['drive'] = argv._[0];
  params['config'] = argv['config'] || path.join(process.env.PWD, '.wikigdrive');
  params['dest'] = argv['dest'] || process.env.PWD;
  params['watch'] = !!argv['watch'];

  params['client_id'] = argv['client_id'] || process.env.CLIENT_ID;
  params['client_secret'] = argv['client_secret'] || process.env.CLIENT_SECRET;

  params['link_mode'] = argv['link_mode'] || 'mdURLs';

  params['config-reset'] = argv['config-reset'] || '';
  if (argv['config-reset-all']) {
    params['config-reset'] = 'google_auth,fileMap,binaryFiles,startTrackToken';
  }
  params['flat-folder-structure'] = !!argv['without-folder-structure'];

  const mainService = new SyncService(params);
  return await mainService.start();
}

require('dotenv').config();

index()
  .then(() => {
    console.log('Finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error', err);
    process.exit(1);
  });
