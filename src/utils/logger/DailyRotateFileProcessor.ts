import {PassThrough} from 'stream';
import fs from 'fs';
import zlib from 'zlib';

export class DailyRotateFileProcessor {
  private results: any[];

  constructor(private logFiles: string[], private options) {
    this.results = [];
  }

  createReadStream(logFile: string) {
    if (logFile.endsWith('.gz')) {
      const stream = new PassThrough();
      fs.createReadStream(logFile).pipe(zlib.createGunzip()).pipe(stream);
      return stream;
    } else {
      return fs.createReadStream(logFile, {
        encoding: 'utf8'
      });
    }
  }

  processLogFile(logFile) {
    return new Promise((resolve, reject) => {
      const stream = this.createReadStream(logFile);

      stream.on('error', (err) => {
        if (stream.readable) {
          stream.destroy();
        }

        if (err['code'] === 'ENOENT') {
          resolve(null);
        } else {
          reject(err);
        }
      });

      let buff = '';
      stream.on('data', (data) => {
        const dataArr = (buff + data).split(/\n+/);
        const l = dataArr.length - 1;

        for (let i = 0; i < l; i++) {
          try {
            this.add(dataArr[i]);
          } catch (e) {
            stream.emit('error', e);
          }
        }

        buff = dataArr[l];
      });

      stream.on('end', () => {
        if (buff) {
          try {
            this.add(buff);
            // eslint-disable-next-line no-empty
          } catch (onlyAttempt) {}
        }

        resolve(null);
      });

    });
  }

  add(buff: string) {
      const log = JSON.parse(buff);
      if (!log || typeof log !== 'object') {
        return;
      }

      const time = new Date(log.timestamp);
      log.timestamp = +time;
      const options = this.options;
      if ((options.from && time < options.from) ||
        (options.until && time > options.until) ||
        (options.level && options.level !== log.level)) {
        return;
      }

      this.results.push(log);
  }

  async query() {
    const retVal = [];
    const logFiles = (this.options.order === 'desc') ? this.logFiles.reverse() : this.logFiles;

    const start = this.options.start || 0;
    const limit = this.options.limit || 100;

    for (const logFile of logFiles) {
      this.results = [];

      await this.processLogFile(logFile);

      this.results.sort((a, b) => {
        const d1 = new Date(a.timestamp).getTime();
        const d2 = new Date(b.timestamp).getTime();

        return d1 > d2 ? 1 : d1 < d2 ? -1 : 0;
      });

      if (this.options.order === 'desc') {
        this.results = this.results.reverse();
      }

      if (this.options.fields) {
        this.results = this.results.map((log) => {
          const obj = {};
          this.options.fields.forEach((key) => {
            obj[key] = log[key];
          });
          return obj;
        });
      }

      if (retVal.length > start + limit) {
        break;
      }

      retVal.push(...this.results);
    }

    return retVal.slice(start, start + limit);
  }
}
