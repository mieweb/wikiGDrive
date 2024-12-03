import fs, {ReadStream} from 'node:fs';
import {PassThrough, Readable} from 'node:stream';
import zlib from 'node:zlib';
import {FileId} from '../../model/model.ts';

interface LogLine {
  level: 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  filename: string;
  driveId: FileId;
  jobId: string;
  payload?: {[key: string]: string | number};
}

export class JobLogFileProcessor {
  constructor(private logFile: string, private options) {
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

  processLogFile(logFile: string): Promise<LogLine[]> {
    return new Promise((resolve, reject) => {
      const results = [];
      const [, stream] = this.createReadStream(logFile);

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

          results.push(logLine);
        }

        buff = dataArr[l];
      });

      stream.on('end', () => {
        if (buff) {
          const logLine = this.stringToLogLine(buff);
          if (!logLine) return;

          results.push(logLine);
        }

        resolve(results);
      });

    });
  }

  async query() {
    const retVal = [];
    let results: LogLine[] = await this.processLogFile(this.logFile);

    if (this.options.order === 'desc') {
      results = results.reverse();
    }

    retVal.push(...results);

    return retVal;
  }
}
