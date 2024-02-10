import {Logger} from 'vite';
import * as vite from 'vite';
import {fileURLToPath} from 'url';
import path from 'path';
import type {Application} from 'express';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';

export async function initUiServer(app: Application, logger: winston.Logger) {
  const customLogger: Logger = {
    hasWarned: false,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    clearScreen() {},
    error: (msg: string) => {
      logger.error(msg);
    },
    hasErrorLogged: () => {
      return false;
    },
    info: (msg: string) => {
      logger.info(msg);
    },
    warn: (msg: string) => {
      logger.warn(msg);
    },
    warnOnce: (msg: string) => {
      logger.warn(msg);
    }
  };

  const viteInstance = await vite.createServer({
    root: HTML_DIR,
    logLevel: 'info',
    appType: 'custom',
    server: {
      middlewareMode: true,
      watch: {
        // During tests, we edit the files too fast and sometimes chokidar
        // misses change events, so enforce polling for consistency
        usePolling: true,
        interval: 100
      }
    },
    customLogger: customLogger
  });
  app.set('viteInstance', viteInstance);
  app.use(viteInstance.middlewares);
}
