import * as winston from 'winston';

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
    console.error(message);
    return `${timestamp} [${level}]: ${message}` + errorStr;
  }
});

export function createLogger(eventBus) {
  let configService;
  eventBus.on('configService:initialized', (configServiceParam) => {
    configService = configServiceParam;
  });

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

  process
    .on('unhandledRejection', async (reason: any, p) => {
      // if (reason'invalid_grant')
      logger.error(reason, 'Unhandled Rejection at Promise', p);

      if (reason.origError) {
        reason = reason.origError;
      }

      if (reason?.response?.data?.error === 'invalid_grant') {
        if (configService) {
          await configService.saveGoogleAuth(null);
          await configService.flushData();
        }
      }
      process.exit(1);
    })
    .on('uncaughtException', err => {
      logger.error('Uncaught Exception thrown', err);
      process.exit(1);
    });


  return logger;
}
