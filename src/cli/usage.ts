import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function usage(filename: string) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json')).toString());

  console.log(
    `version: ${pkg.version}, ${process.env.GIT_SHA}${`
Usage:
    $ wikigdrive <command> [args] [<options>]

Main commands:

    wikigdrive config
        --client_id
        --client_secret
        --service_account=./private_key.json

    wikigdrive service 

    wikigdrive add [folder_id_or_url]
        --drive [shared drive url]
        --workdir (current working folder)
        --link_mode [mdURLs|dirURLs|uglyURLs]

    wikigdrive pull [URL to specific file]

    wikigdrive watch (keep scanning for changes, ie: daemon)

Other commands:

    wikigdrive status [ID of document]   - Show status of the document or stats of the entire path.
    wikigdrive drives
    wikigdrive sync
    wikigdrive download
    wikigdrive transform

Options:
    --workdir (current working folder)

Examples:
    $ wikigdrive init
    $ wikigdrive add https://google.drive...
    `}`);
}
