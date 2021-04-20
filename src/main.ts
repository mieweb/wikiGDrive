'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as minimist from 'minimist';
import {CliParams, MainService} from './MainService';
import * as pkg from '../package.json';

function usage() {
  console.log(
    `version: ${pkg.version}${`
Usage:
    $ wikigdrive <command> [args] [<options>]

Main commands:

    wikigdrive init
        --drive [shared drive url]
        --client_id
        --client_secret
        --service_account=./private_key.json
        --drive_id
        --dest (current working folder)
        --link_mode [mdURLs|dirURLs|uglyURLs]
        --without-folder-structure

    wikigdrive pull [URL to specific file]

    wikigdrive watch --watch_mode [mtime|changes] (keep scanning for changes, ie: daemon)

Other commands:

    wikigdrive status [ID of document]   - Show status of the document or stats of the entire path.
    wikigdrive drives
    wikigdrive sync
    wikigdrive download
    wikigdrive transform

Options:
    --config_dir (.wgd)
    --disable-progress
    --dest (current working folder)

Examples:
    $ wikigdrive init --drive https://google.drive...
    `}`);
}

async function main() {
  const argv = minimist(process.argv.slice(2));

  if (argv._.length < 1 || argv.h || argv.help) {
    usage();
    process.exit(0);
  }

  // PWD is null on Windows, so we can set it here
  process.env.PWD = process.cwd();

  const default_wgd_dir = (argv['dest'] && fs.existsSync(path.join(argv['dest'], '.wgd')))
    ? path.join(argv['dest'], '.wgd')
    : path.join(process.env.PWD, '.wgd');

  const params: CliParams = {
    command: argv._[0],
    args: argv._.slice(1),
    drive: argv['drive'],
    config_dir: argv['config_dir'] || default_wgd_dir,
    dest: argv['dest'] || process.env.PWD,
    watch_mode: argv['watch_mode'] || 'changes',

    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,

    link_mode: argv['link_mode'] || 'mdURLs',

    flat_folder_structure: !!argv['without-folder-structure'],
    debug: (argv['debug'] || '').split(',').map(str => str.toLocaleString().trim()),

    drive_id: argv['drive_id'] || '',
    service_account: argv['service_account'] || null,
    git_update_delay: argv['git_update_delay'] || 60,
    force: !!argv['force'],
    disable_progress: !!argv['disable-progress']
  };
  
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

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error', err);
    process.exit(1);
  });
