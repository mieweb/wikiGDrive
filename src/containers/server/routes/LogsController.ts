import {Controller, RouteGet, RouteParamPath, RouteParamQuery} from './Controller';
import {Logger, QueryOptions} from 'winston';

export class LogsController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  async getConfig(@RouteParamPath('driveId') driveId: string, @RouteParamQuery('from') from: number) {
    const options: QueryOptions = {
      from: new Date(+from || +new Date() - (24 * 60 * 60 * 1000)),
      until: new Date(),
      limit: 1000,
      // start: 0,
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

    return results['dailyRotateFile'].reverse();
  }

}
