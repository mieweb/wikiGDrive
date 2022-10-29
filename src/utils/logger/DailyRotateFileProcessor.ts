import {PassThrough, Readable, Transform} from 'stream';
import fs, {ReadStream} from 'fs';
import zlib from 'zlib';
import {FileId} from '../../model/model';

interface LogLine {
  level: 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  filename: string;
  driveId: FileId;
  payload?: {[key: string]: string | number};
}

export class DailyRotateFileProcessor {

  constructor(private logFiles: string[], private options) {
  }

  createReadStream(logFile: string): [ReadStream, Readable] {
    const readStream = fs.createReadStream(logFile);

    if (logFile.endsWith('.gz')) {
      const stream = new PassThrough();
      readStream.pipe(zlib.createGunzip()).pipe(stream);
      return [readStream, stream];
    } else {
      return [readStream, readStream];
    }
  }

  stringToLogLine(buff: string) {
    try {
      const log: LogLine = JSON.parse(buff);
      if (!log || typeof log !== 'object') {
        return null;
      }

      const time = new Date(log.timestamp);
      log.timestamp = +time;

      if (this.options.level && this.options.level !== log.level) {
        return null;
      }

      return log;
    } catch (err) {
      return null;
    }
  }

  processLogFile(logFile): Promise<LogLine[]> {
    return new Promise((resolve, reject) => {
      const results = [];
      const [readStream, stream] = this.createReadStream(logFile);

      stream.on('error', (err) => {
        if (stream.readable) {
          stream.destroy();
        }

        if (err['code'] === 'ENOENT') {
          resolve(results);
        } else {
          reject(err);
        }
      });

      let buff = '';
      stream.on('data', (data) => {
        const dataArr = (buff + data).split(/\n+/);
        const l = dataArr.length - 1;

        for (let i = 0; i < l; i++) {
          const logLine = this.stringToLogLine(dataArr[i]);
          if (!logLine) continue;

          if (this.options.from && logLine.timestamp < this.options.from) {
            if (this.options.order === 'desc') {
              buff = '';
              readStream.close();
              return;
            }
            continue;
          }
          if (this.options.until && logLine.timestamp > this.options.until) {
            if (this.options.order === 'asc') {
              buff = '';
              readStream.close();
              return;
            }
            continue;
          }

          results.push(logLine);
        }

        buff = dataArr[l];
      });

      stream.on('end', () => {
        if (buff) {
          const logLine = this.stringToLogLine(buff);
          if (!logLine) return;

          if (this.options.from && logLine.timestamp < this.options.from) {
            return;
          }
          if (this.options.until && logLine.timestamp > this.options.until) {
            return;
          }

          results.push(logLine);
        }

        resolve(results);
      });

    });
  }

  async query() {
    const retVal = [];
    const logFiles = (this.options.order === 'desc') ? this.logFiles.reverse() : this.logFiles;

    const start = this.options.start || 0;
    const limit = this.options.limit || 100;

    for (const logFile of logFiles) {
      let results: LogLine[] = await this.processLogFile(logFile);

      results.sort((a, b) => {
        const d1 = new Date(a.timestamp).getTime();
        const d2 = new Date(b.timestamp).getTime();

        return d1 > d2 ? 1 : d1 < d2 ? -1 : 0;
      });

      if (this.options.order === 'desc') {
        results = results.reverse();
      }

      if (retVal.length > start + limit) {
        break;
      }

      retVal.push(...results);

      if (this.options.length <= retVal.length) {
        break;
      }
    }

    return retVal.slice(start, start + limit);
  }
}
