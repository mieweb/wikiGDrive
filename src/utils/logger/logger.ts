import winston from 'winston';
import {EventEmitter} from 'events';
import path from 'path';
import {DailyRotateFile} from './DailyRotateFile';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function getStackInfo(stackIndex) {
  // get call stack, and analyze it
  // get all file, method, and line numbers
  const stackList = (new Error()).stack.split('\n').slice(3);

  // stack trace format:
  // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  // do not remove the regex expresses to outside this method (due to a BUG in node.js)
  const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi;
  const stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi;

  const s = stackList[stackIndex] || stackList[0];
  const sp = stackReg.exec(s) || stackReg2.exec(s);

  if (sp && sp.length === 5) {
    sp[2] = sp[2].replace('file://', '');
    return {
      method: sp[1],
      path: sp[2],
      line: sp[3],
      pos: sp[4],
      file: path.basename(sp[2]),
      stack: stackList.join('\n')
    };
  }
}

const myFormat = winston.format.printf((params) => {
  const { level, message, timestamp } = params;
  let { filename } = params;

  let errorStr = '';
  if (level === 'error') {
    if (params.stack) {
      errorStr += ' ' + params.stack;
    }
    if (params.origError) {
      errorStr += ' ' + JSON.stringify(params.origError, null, 2);
    }
  }

  if (filename) {
    filename = path.relative(PROJECT_ROOT, filename);
  }

  if ('/index.js' === filename) {
    filename = null;
  }

  if (filename) {
    return `${timestamp} [${level}] (${filename}): ${message}` + errorStr;
  } else {
    return `${timestamp} [${level}]: ${message}` + errorStr;
  }
});

function instrumentLogger(logger, childOpts = {}) {
  for (const funcName of ['info', 'error', 'warn']) {
    const originMethod = logger[funcName];
    logger[funcName] = (msg, payload) => {
      const stackInfo = getStackInfo(0);
      if (!payload?.filename && stackInfo) {
        let filename = path.relative(PROJECT_ROOT, stackInfo.path);
        if (stackInfo.line) {
          filename += ':' + stackInfo.line;
          if (stackInfo.pos) {
            filename += ':' + stackInfo.pos;
          }
        }
        payload = Object.assign({}, childOpts, payload, {
          filename
        });
      }
      originMethod.apply(logger, [msg, payload]);
      return logger;
    };
  }

  const originMethod = logger.child;
  logger.child = (opts) => {
    const childLogger = originMethod.apply(logger, [opts]);
    instrumentLogger(childLogger, opts);
    return childLogger;
  };
}

export function createLogger(eventBus: EventEmitter, workdir: string) {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      myFormat
    ),
    defaultMeta: {},
    transports: [
      //
      // - Write all logs with level `error` and below to `error.log`
      // - Write all logs with level `info` and below to `combined.log`
      //
    ],
  });

  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      myFormat
    )
  }));

  const dirname = path.join(workdir, '%driveId%', '.logs');
  logger.add(new DailyRotateFile({
    format: winston.format.json(),
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    dirname: dirname,
    createSymlink: true,
    symlinkName: 'error.log',
    filename: '%DATE%-error.log',
    level: 'error',
    json: true
  }));
  logger.add(new DailyRotateFile({
    format: winston.format.json(),
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    dirname: dirname,
    createSymlink: true,
    symlinkName: 'combined.log',
    filename: '%DATE%-combined.log',
    json: true
  }));

  instrumentLogger(logger);

  process
    .on('unhandledRejection', async (reason: any) => {
      console.error(reason);
      logger.error('unhandledRejection: ' + reason.message, reason);

      if (reason.origError) {
        reason = reason.origError;
      }

      if (reason?.response?.data?.error === 'invalid_grant') {
        eventBus.emit('panic:invalid_grant');
        return;
      }
      process.exit(1);
    })
    .on('uncaughtException', err => {
      console.error(err);
      logger.error('Uncaught Exception thrown', err);
      process.exit(1);
    });


  return logger;
}
