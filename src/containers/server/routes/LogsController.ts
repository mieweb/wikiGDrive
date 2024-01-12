import {Controller, RouteGet, RouteParamPath, RouteParamQuery} from './Controller.ts';
import {Logger} from 'winston';

export class LogsController extends Controller {

  constructor(subPath: string, private readonly queryLogger: Logger) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  async getConfig(@RouteParamPath('driveId') driveId: string,
                  @RouteParamQuery('from') from?: number,
                  @RouteParamQuery('until') until?: number,
                  @RouteParamQuery('jobId') jobId?: string,
                  @RouteParamQuery('order') order?: 'desc' | 'asc',
                  @RouteParamQuery('offset') offset?: number
                  ) {

    if (!until && !from) {
      if (order === 'desc') {
        until = +new Date();
      } else {
        from = +new Date();
      }
    }

    const options: any = {
      from: from ? new Date(+from) : undefined,
      until: until ? new Date(+until) : undefined,
      jobId,
      order: order || 'asc',
      start: 0,
      limit: 100,
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

    if (jobId) {
      return results['jobLogFile'].slice(offset || 0);
    }

    return results['dailyRotateFile'].reverse().slice(offset || 0);
  }

}
