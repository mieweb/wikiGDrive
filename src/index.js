'use strict';

import path from 'path';
import minimist from 'minimist';
import { SyncService } from './SyncService';
import pkg from '../package.json';

function usage() {
  console.log(
    `version: ${pkg.version}${`
    Usage:
    $ wikigdrive <command> [<options>]

Commands: 
    wikigdrive init
    --drive [shared drive url]
    --client_id
    --client_secret
    --service_account=./private_key.json
    --drive_id
    --dest (current working folder)
    --without-folder-structure
    --link_mode [mdURLs|dirURLs|uglyURLs]

    wikigdrive pull

    wikigdrive watch
    --watch_mode [mtime|changes] (keep scanning for changes, ie: daemon)

Options:
    --config_dir (.wikigdrive)

TODO: remove?
    --config-reset google_auth # removes google_auth object from .wikidgrive file
    --config-reset fileMap # removes fileMap object from .wikidgrive file
    --config-reset binaryFiles # removes binaryFiles object from .wikidgrive file
    --config-reset-all # leaves empty .wikigdrive file

Examples:
    $ wikigdrive https://google.drive...
    `}`);
}

async function index() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length !== 1 || argv.h || argv.help) {
    usage();
    process.exit(1);
  }

  const params = {};

  params['command'] = argv._[0];
  params['drive'] = argv['drive'];
  params['config_dir'] = argv['config_dir'] || path.join(process.env.PWD, '.wikigdrive');
  params['dest'] = argv['dest'] || process.env.PWD;
  params['watch_mode'] = argv['watch_mode'];

  params['client_id'] = argv['client_id'] || process.env.CLIENT_ID;
  params['client_secret'] = argv['client_secret'] || process.env.CLIENT_SECRET;

  params['link_mode'] = argv['link_mode'] || 'mdURLs';

  params['config-reset'] = argv['config-reset'] || '';
  if (argv['config-reset-all']) {
    params['config-reset'] = 'google_auth,fileMap,binaryFiles';
  }
  params['flat-folder-structure'] = !!argv['without-folder-structure'];
  params['debug'] = !!argv['debug'];

  params['drive_id'] = argv['drive_id'] || '';
  params['service_account'] = argv['service_account'] || null;

  const mainService = new SyncService(params);
  try {
    await mainService.init();
  } catch (err) {
    usage();
    console.error(err);
    process.exit(1);
  }
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
