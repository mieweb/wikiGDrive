'use strict';

import path from "path";
import {SyncService} from "./SyncService";

const minimist = require('minimist');

function usage() {
  console.log(
    `Usage:
    $ wikigdrive [shared drive url]

Options:
    --config (.wikigdrive)
    --user
    --pass
    --dest (current working folder)
    --watch (keep scanning for changes, ie: daemon)

Examples:
    $ wikigdrive
    `);
}


async function index() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length != 1 || argv.h || argv.help) {
    usage();
    process.exit(1);
  }

  const params = {};

  params['drive'] = argv._[0];
  params['config'] = argv['config'] || path.join(process.env.PWD, '.wikigdrive');
  params['dest'] = argv['dest'] || process.env.PWD;
  params['watch'] = !!argv['watch'];

  params['user'] = argv['user'];
  params['pass'] = argv['pass'];

  const mainService = new SyncService(params);
  return await mainService.start();
}

index()
  .then(() => {
    console.log('Finished');
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error', err);
    process.exit(1);
  });


