import path from 'path';
import fs from 'fs';
import type {Application, Request, Response, NextFunction} from 'express';
import {fileURLToPath} from 'url';
import {generateIndexHtml} from '@mieweb/wikigdrive-ui/vite.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';
const MAIN_DIR = __dirname + '/../../..';

export async function handleStaticHtml(app: Application, reqPath: string, url: string, template?: string) {
  const renderedPath = path.resolve(MAIN_DIR, 'website', '.vitepress', 'dist', (reqPath.substring(1) || 'index.html'));
  const distPath = path.resolve(HTML_DIR, 'website', '.vitepress', 'dist');

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
    } else if (fs.existsSync(distPath)) {
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
