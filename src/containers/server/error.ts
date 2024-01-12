import type {Application, NextFunction, Request, Response} from 'express';
import winston from 'winston';

import {GoogleDriveServiceError} from '../../google/driveFetch';
import {AuthError} from './auth';
import {handleStaticHtml} from './static';

export async function initErrorHandler(app: Application, logger: winston.Logger) {
  app.use(async (err: GoogleDriveServiceError & AuthError, req: Request, res: Response, next: NextFunction) => {
    const code = err.status || 501;
    logger.warn(`http error ${code} for: ${req.originalUrl}`);

    if (err.showHtml) {
      const indexHtml = await handleStaticHtml(app, req.path, req.originalUrl);
      if (indexHtml) {
        res.status(err.status).header('Content-type', 'text/html').end(
          indexHtml.replace('</head', `<meta name="errorMessage" content="${err.message}"></head`)
        );
        return;
      }
    }

    switch(code) {
      case 302:
        res.redirect('/');
        return;
      case 404:
      {
        const indexHtml = await handleStaticHtml(app, req.path, req.originalUrl);
        if (indexHtml) {
          res.status(404).header('Content-type', 'text/html').end(indexHtml);
        } else {
          res.status(code).send({ code, message: err.message, stack: process.env.VERSION === 'dev' ? err.stack : undefined });
        }
      }
        return;
      case 401:
      {
        const redirectTo: string = req.headers['redirect-to'] ? req.headers['redirect-to'].toString() : '';

        const urlSearchParams = new URLSearchParams();
        if (redirectTo && redirectTo.startsWith('/') && redirectTo.indexOf('//') === -1) {
          urlSearchParams.set('redirectTo', redirectTo);
        } else {
          urlSearchParams.set('redirectTo', '/drive/' + (req['driveId'] || ''));
        }
        if (process.env.VERSION === 'dev') {
          logger.warn(err.stack ? err.stack : err.message);
        } else {
          logger.warn(err.message);
        }

        if (req['driveId']) {
          err.authPath = '/auth/' + req['driveId'] + '?' + urlSearchParams.toString();
        } else {
          err.authPath = '/auth/none?' + urlSearchParams.toString();
        }
        res.status(code).send({ message: err.message, authPath: err.authPath, stack: process.env.VERSION === 'dev' ? err.stack : undefined });
      }
        return;
      default:
        console.error(err);
    }

    res.header('Content-type', 'application/json');
    res.status(code).send({ message: err.message });

    next();
  });
}
