'use strict';

import path from 'path';
import minimist from 'minimist';
import { MainService } from './MainService';
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
    --config_dir (.wgd)

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
  params['config_dir'] = argv['config_dir'] || path.join(process.env.PWD, '.wgd');
  params['dest'] = argv['dest'] || process.env.PWD;
  params['watch_mode'] = argv['watch_mode'] || 'changes';

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

  process.on('unhandledRejection', function(err) {
    console.error('process.on:unhandledRejection', err);
    process.exit(1);
  });

  const mainService = new MainService(params);
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
