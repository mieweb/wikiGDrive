'use strict';

import path from 'path';
import fs from 'fs';
import minimist from 'minimist';
import {MainService} from './MainService';
import dotenv from 'dotenv';
import {CliParams} from './model/CliParams';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function usage() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString());

  console.log(
    `version: ${pkg.version}${`
Usage:
    $ wikigdrive <command> [args] [<options>]

Main commands:

    wikigdrive config
        --client_id
        --client_secret
        --service_account=./private_key.json

    wikigdrive service 

    wikigdrive add [folder_id_or_url]
        --drive_id
        --drive [shared drive url]
        --workdir (current working folder)
        --link_mode [mdURLs|dirURLs|uglyURLs]
        --without-folder-structure

    wikigdrive pull [URL to specific file]

    wikigdrive watch (keep scanning for changes, ie: daemon)

Other commands:

    wikigdrive status [ID of document]   - Show status of the document or stats of the entire path.
    wikigdrive drives
    wikigdrive sync
    wikigdrive download
    wikigdrive transform

Options:
    --config_dir (.wgd)
    --disable-progress
    --workdir (current working folder)

Examples:
    $ wikigdrive init
    $ wikigdrive add https://google.drive...
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

  const params: CliParams = {
    command: argv._[0],
    args: argv._.slice(1),
    drive: argv['drive'],
    config_dir: argv['config_dir'] || process.env.WIKIGDRIVE_WORKDIR || '/data',
    workdir: argv['workdir'] || process.env.WIKIGDRIVE_WORKDIR || '/data',

    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,

    link_mode: argv['link_mode'] || 'mdURLs',

    debug: (argv['debug'] || '').split(',').map(str => str.toLocaleString().trim()),

    drive_id: argv['drive_id'] || '',
    service_account: argv['service_account'] || null,
    share_email: argv['share_email'] || null,
    git_update_delay: argv['git_update_delay'] || 60,
    force: !!argv['force'],
    disable_progress: !!argv['disable-progress'],
    server_port: +argv['server']
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

dotenv.config();

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error', err);
    process.exit(1);
  });
