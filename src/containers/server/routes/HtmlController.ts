import {Controller, RouteResponse, RouteUse} from './Controller';
import fs from 'fs';
import path from 'path';

export default class HtmlController extends Controller {
  private indexHtml: string;

  constructor(subPath: string, HTML_DIR) {
    super(subPath);

    this.indexHtml = fs.readFileSync(path.resolve(HTML_DIR, 'index.html'))
      .toString()
      .replace('</head>', process.env.ZIPKIN_URL ? `<meta name="ZIPKIN_URL" content="${process.env.ZIPKIN_URL}" />\n</head>` : '</head>')
      .replace(/GIT_SHA/g, process.env.GIT_SHA);
  }

  @RouteUse('/')
  @RouteResponse('html', {}, 'text/html')
  indexHandler() {
    return this.indexHtml;
  }

}
