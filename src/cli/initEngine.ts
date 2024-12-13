import {EventEmitter} from 'node:events';
import process from 'node:process';

import {FileContentService} from '../utils/FileContentService.ts';
import {createLogger} from '../utils/logger/logger.ts';
import {ContainerEngine} from '../ContainerEngine.ts';

export async function initEngine(workdir: string) {
  const mainFileService = new FileContentService(workdir);
  await mainFileService.mkdir('/');

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
  return {mainFileService, containerEngine, logger};
}
