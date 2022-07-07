import winston from 'winston';
import {EventEmitter} from 'events';
import path from 'path';
import {DailyRotateFile} from './DailyRotateFile';

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
    filename = filename.replace(/^.+\//sg, '');
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
