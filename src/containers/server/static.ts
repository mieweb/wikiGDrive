import path from 'path';
import fs from 'fs';
import express from 'express';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_DIR = __dirname + '/../../../apps/ui';
const MAIN_DIR = __dirname + '/../../..';

export async function handleStaticHtml(app: express.Application, reqPath: string, url: string) {
  const hugoPath = path.resolve(MAIN_DIR, 'dist', 'hugo', (reqPath.substring(1) || 'index.html'));
  const generatedHtmlPath = path.resolve(MAIN_DIR, 'dist', 'hugo', 'ui', 'index.html');
  const distPath = path.resolve(HTML_DIR, 'dist');
  const baseHtmlPath = path.resolve(MAIN_DIR, 'hugo', 'themes', 'wgd-bootstrap', 'layouts', '_default', 'baseof.html');

  if (reqPath.startsWith('/drive') || reqPath.startsWith('/gdocs') || reqPath.startsWith('/auth') || reqPath === '/' || reqPath.startsWith('/share-drive') || reqPath.endsWith('.html')) {
    if (fs.existsSync(hugoPath)) {
      const template = fs.readFileSync(hugoPath)
        .toString()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);
      return template;
    } else if (fs.existsSync(distPath)) {
      const template = fs.readFileSync(path.join(distPath, 'index.html'))
        .toString()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);
      return template;
    } else if (fs.existsSync(generatedHtmlPath)) {
      const template = fs.readFileSync(generatedHtmlPath)
        .toString()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);
      return template;
    } else {
      const template = fs.readFileSync(baseHtmlPath)
        .toString()
        .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
        .replace(/GIT_SHA/g, process.env.GIT_SHA);

      const viteInstance = app.get('viteInstance');

      return await viteInstance.transformIndexHtml(url, template);
    }
  }
  return null;
}

export async function initStaticDistPages(app: express.Application) {
  app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const indexHtml = await handleStaticHtml(app, req.path, req.originalUrl);
    if (indexHtml) {
      res.status(200).header('Content-type', 'text/html').end(indexHtml);
    } else {
      // res.status(404).json({});
      next();
    }
  });
}
