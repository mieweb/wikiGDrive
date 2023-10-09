'use strict';

import path from 'path';
import minimist from 'minimist';
import dotenv from 'dotenv';
import {fileURLToPath} from 'url';

import {addTelemetry} from '../telemetry';
import {GoogleApiContainer} from '../containers/google_api/GoogleApiContainer';
import {FileContentService} from '../utils/FileContentService';
import {getAuthConfig} from './getAuthConfig';
import {urlToFolderId} from '../utils/idParsers';
import {FolderRegistryContainer} from '../containers/folder_registry/FolderRegistryContainer';
import {ContainerEngine} from '../ContainerEngine';
import {createLogger} from '../utils/logger/logger';
import {EventEmitter} from 'events';
import {usage} from './usage';

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

  const args = argv._.slice(1);

  // PWD is null on Windows, so we can set it here
  process.env.PWD = process.cwd();

  const workdir = argv['workdir'] || process.env.WIKIGDRIVE_WORKDIR || '/data';

  const mainFileService = new FileContentService(workdir);
  await mainFileService.mkdir('/');

  const params = {
    client_id: argv['client_id'] || process.env.CLIENT_ID,
    client_secret: argv['client_secret'] || process.env.CLIENT_SECRET,
    service_account: argv['service_account'] || null,
  };

  const authConfig = await getAuthConfig(params, mainFileService);

  const apiContainer = new GoogleApiContainer({ name: 'google_api' }, authConfig);
  await apiContainer.mount(await mainFileService);
  await apiContainer.run();

  const folderId = urlToFolderId(args[0]);
  if (!folderId) {
    throw new Error('No folderId');
  }

  const eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);
  eventBus.on('panic:invalid_grant', () => {
    process.exit(1);
  });
  eventBus.on('panic', (error) => {
    throw error;
  });

  const logger = createLogger(workdir, eventBus);
  const containerEngine = new ContainerEngine(logger, mainFileService);

  const folderRegistryContainer = new FolderRegistryContainer({ name: 'folder_registry' });
  await folderRegistryContainer.mount(await mainFileService);
  await containerEngine.registerContainer(folderRegistryContainer);
  await folderRegistryContainer.run();
  const folder = await folderRegistryContainer.registerFolder(folderId);
  if (folder.new) {
    logger.info('New folder registered. Run: wikigdrive pull');
  }

  await containerEngine.flushData();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
