import {Logger} from 'winston';

import {
  Controller, RouteParamBody, RoutePost,
} from './Controller.ts';

export class WebHookController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RoutePost('/')
  async postEvent(@RouteParamBody() body: undefined) {
    this.queryLogger.info(`WebHookController.postEvent ${JSON.stringify(body)}`);

    return {};
  }
}
