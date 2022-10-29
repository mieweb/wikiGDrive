import {Controller, RouteGet, RouteParamPath, RouteParamQuery} from './Controller';
import {Logger, QueryOptions} from 'winston';

export class LogsController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  async getConfig(@RouteParamPath('driveId') driveId: string,
                  @RouteParamQuery('from') from?: number,
                  @RouteParamQuery('until') until?: number,
                  @RouteParamQuery('order') order?: 'desc' | 'asc'
                  ) {

    if (!until && !from) {
      return [];
    }

    const options: QueryOptions = {
      from: from ? new Date(+from) : undefined,
      until: until ? new Date(+until) : undefined,
      order: order || 'asc',
      start: 0,
      limit: 1000,
      fields: undefined
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
