import {Controller, RouteResponse, RouteUse} from './Controller';
import fs from 'fs';
import {fileURLToPath} from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);

const indexHtml = fs.readFileSync(path.resolve(path.dirname(__filename), '..', 'static', 'index.html'))
  .toString()
  .replace(/GIT_SHA/g, process.env.GIT_SHA);

export default class HtmlController extends Controller {


  @RouteUse('/')
  @RouteResponse('html', {}, 'text/html')
  indexHandler() {
    return indexHtml;
  }

}
