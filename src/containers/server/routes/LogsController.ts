import {Controller, RouteGet, RouteParamPath} from './Controller';
import {Logger, QueryOptions} from 'winston';

export class LogsController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  async getConfig(@RouteParamPath('driveId') driveId: string) {
    const options: QueryOptions = {
      from: new Date(+new Date() - (24 * 60 * 60 * 1000)),
      until: new Date(),
      limit: 100,
      start: 0,
      order: 'desc',
      fields: undefined//['message']
    };

    options['driveId'] = driveId;

    const results = await new Promise((resolve, reject) => this.queryLogger.query(options, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    }));
    return results['dailyRotateFile'];
  }

}
