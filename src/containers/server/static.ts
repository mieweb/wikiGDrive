import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';

import type {Application, Request, Response, NextFunction} from 'express';
import {generateIndexHtml} from '../../../apps/ui/vite.config.ts';

const __dirname = import.meta.dirname;
const MAIN_DIR = __dirname + '/../../..';

export async function handleStaticHtml(app: Application, reqPath: string, url: string, template?: string) {
  let renderedPath = path.resolve(MAIN_DIR, 'website', '.vitepress', 'dist', (reqPath.substring(1) || 'index.html'));

  if (!renderedPath.startsWith(path.resolve(MAIN_DIR))) {
    return null;
  }

  if (reqPath.startsWith('/drive')
    || reqPath.startsWith('/gdocs')
    || reqPath.startsWith('/auth')
    || reqPath === '/'
    || reqPath.startsWith('/share-drive')
    || reqPath.endsWith('.html')) {

    if (fs.existsSync(renderedPath)) {
      const template = generateIndexHtml()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);
      return template;
    } else {
      const template = generateIndexHtml()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);

      const viteInstance = app.get('viteInstance');

      return await viteInstance.transformIndexHtml(url, template);
    }
  }
  return null;
}

export async function initStaticDistPages(app: Application) {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const indexHtml = await handleStaticHtml(app, req.path, req.originalUrl);
    if (indexHtml) {
      res.status(200).header('Content-type', 'text/html').end(indexHtml);
    } else {
      // res.status(404).json({});
      next();
    }
  });
}
