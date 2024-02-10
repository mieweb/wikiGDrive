import fs, {ReadStream} from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import Transport, {TransportStreamOptions} from 'winston-transport';

import {FileStreamRotator} from './FileStreamRotator';
import crypto from 'crypto';
import {DailyRotateFileProcessor} from './DailyRotateFileProcessor';
import {StreamOptions} from 'stream';

const loggerDefaults = {
  json: false,
  colorize: false,
  eol: os.EOL,
  logstash: null,
  prettyPrint: false,
  label: null,
  stringify: false,
  depth: null,
  showLevel: true,
  timestamp: () => {
    return new Date().toISOString();
  }
};

function hash(obj) {
  const hash = crypto.createHash('md5');
  hash.setEncoding('hex');
  hash.write(JSON.stringify(obj));
  hash.end();
  return hash.read();
}

function getMaxSize(size: string | number) {
  if (size && typeof size === 'string') {
    const _s = size.toLowerCase().match(/^((?:0\.)?\d+)([k|mg])$/);
    if (_s) {
      return size;
    }
  } else if (size && typeof size === 'number' && Number.isInteger(size)) {
    const sizeK = Math.round(size / 1024);
    return sizeK === 0 ? '1k' : sizeK + 'k';
  }

  return null;
}

function isValidFileName(filename) {
  // eslint-disable-next-line no-control-regex
  return !/["<>|:*?\\/\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f]/g.test(filename);
}

function isValidDirName(dirname) {
  // eslint-disable-next-line no-control-regex
  return !/["<>|\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f]/g.test(dirname);
}

interface RotateStreamOptions extends TransportStreamOptions {
  json?: boolean;
  file_options?: StreamOptions<ReadStream>;
  datePattern?: string;
  zippedArchive?: boolean;
  maxSize?: string;
  symlinkName?: string;
  createSymlink?: boolean;
  extension?: string;
  utc?: boolean;
  auditFile?: string;
  maxFiles?: string;
  dirname?: string;
  filename?: string;
  eol?: string;
  frequency?: string;
}

export class DailyRotateFile extends Transport {
  name = 'dailyRotateFile';

  private dirname: string;
  private filename: string;
  private logStreamMap: {
    [driveId: string]: FileStreamRotator;
  };
  private options: RotateStreamOptions;

  constructor(options: RotateStreamOptions = {}) {
    super(options);

    this.options = Object.assign({}, loggerDefaults, options);

    this.filename = options.filename ? path.basename(options.filename) : 'winston.log';
    this.dirname = options.dirname || path.dirname(options.filename);

    if (!isValidFileName(this.filename) || !isValidDirName(this.dirname)) {
      throw new Error('Your path or filename contain an invalid character.');
    }

    this.logStreamMap = {};
  }

  getLogStream(driveId: string) {
    driveId = driveId || '';

    if (this.logStreamMap[driveId]) {
      return this.logStreamMap[driveId];
    }

    const options = this.options;

    const dirname = this.dirname.replace('%driveId%', driveId).replace('//', '/');

    const logStream = new FileStreamRotator({
      filename: path.join(dirname, this.filename),
      frequency: options.frequency ? options.frequency : 'custom',
      date_format: options.datePattern ? options.datePattern : 'YYYY-MM-DD',
      verbose: false,
      size: getMaxSize(options.maxSize),
      max_logs: options.maxFiles,
      end_stream: true,
      audit_file: options.auditFile ? options.auditFile : path.join(dirname, '.' + hash(options) + '-audit.json'),
      file_options: options.file_options ? options.file_options : {flags: 'a'},
      utc: options.utc ? options.utc : false,
      extension: options.extension ? options.extension : '',
      create_symlink: options.createSymlink ? options.createSymlink : false,
      symlink_name: options.symlinkName ? options.symlinkName : 'current.log'
    });

    logStream.on('new', (newFile) => {
      this.emit('new', newFile);
    });

    logStream.on('rotate', (oldFile, newFile) => {
      this.emit('rotate', oldFile, newFile);
    });

    logStream.on('logRemoved', (params) => {
      if (options.zippedArchive) {
        const gzName = params.name + '.gz';
        if (fs.existsSync(gzName)) {
          try {
            fs.unlinkSync(gzName);
          }
          catch (_err) {
            // file is there but we got an error when trying to delete,
            // so permissions problem or concurrency issue and another
            // process already deleted it we could detect the concurrency
            // issue by checking err.type === ENOENT or EACCESS for
            // permissions ... but then?
          }
          this.emit('logRemoved', gzName);
          return;
        }
      }
      this.emit('logRemoved', params.name);
    });

    if (options.zippedArchive) {
      logStream.on('rotate', (oldFile) => {
        const oldFileExist = fs.existsSync(oldFile);
        const gzExist = fs.existsSync(oldFile + '.gz');
        if (!oldFileExist || gzExist) {
          return;
        }

        const gzip = zlib.createGzip();
        const inp = fs.createReadStream(oldFile);
        const out = fs.createWriteStream(oldFile + '.gz');
        inp.pipe(gzip).pipe(out).on('finish', () => {
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
          }
          this.emit('archive', oldFile + '.gz');
        });
      });
    }

    this.logStreamMap[driveId] = logStream;

    return logStream;
  }

  log(info, callback) {
    if (!info?.jobId) {
      const logStream = this.getLogStream(info.driveId);
      logStream.write(JSON.stringify(info) + this.options.eol);
      this.emit('logged', info);
    }

    if (callback) {
      callback(null, true);
    }
  }

  async close() {
    const promises = Object.values(this.logStreamMap)
      .map(logStream => new Promise(resolve => logStream.end(resolve)));

    this.logStreamMap = {};

    await Promise.all(promises);
    this.emit('finish');
  }

  async query(options, callback) {
    if (!this.options.json) {
      throw new Error('query() may not be used without the json option being set to true');
    }

    if (!this.filename) {
      throw new Error('query() may not be used when initializing with a stream');
    }

    options = options || {};

    if (options.jobId) {
      callback(null, []);
      return [];
    }

    // limit
    options.rows = options.rows || options.limit || 10;

    // starting row offset
    options.start = options.start || 0;

    // 'asc' or 'desc'
    options.order = options.order || 'desc';

    const fileRegex = new RegExp(this.filename.replace('%DATE%', '.*'), 'i');

    const driveId = options.driveId || '';
    const dirname = this.dirname.replace('%driveId%', driveId).replace('//', '/');

    if (fs.existsSync(dirname)) {
      const logFiles = fs.readdirSync(dirname)
        .filter((file) => {
          const base = path.basename(file);
          if (!base.match(fileRegex)) return false;
          if (base.indexOf('-combined.log') === -1) return false;

          const fileDate = new Date(base.substring(0, 10));

          if (+fileDate <= 0) return false;
          if (options.from && +fileDate < +options.from - 3 * 24 * 3600 * 1000) return false;
          if (options.until && +fileDate > +options.until + 3 * 24 * 3600 * 1000) return false;

          return true;
        })
        .map(file => path.join(dirname, file));

      if (logFiles.length === 0) {
        callback(null, []);
        return [];
      }

      try {
        const processor = new DailyRotateFileProcessor(logFiles, options);
        const results = await processor.query();
        callback(null, results);
        return results;
      } catch (err) {
        callback(err);
        throw err;
      }
    } else {
      callback(null, []);
      return [];
    }
  }

}
