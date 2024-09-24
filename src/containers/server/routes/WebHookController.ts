import {Logger} from 'winston';

import {
  Controller, RouteParamBody, RouteParamHeaders, RoutePost,
} from './Controller.ts';

export class WebHookController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RoutePost('/')
  async postEvent(@RouteParamBody() body: undefined, @RouteParamHeaders() headers: undefined) {
    this.queryLogger.info(`WebHookController.postEvent ${JSON.stringify(headers)} ${JSON.stringify(body)}`);

    return {};
  }
}
