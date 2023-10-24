import path from 'path';
import fs, {ReadStream} from 'fs';
import os from 'os';
import {StreamOptions} from 'stream';
import Transport, {TransportStreamOptions} from 'winston-transport';
import {JobLogFileProcessor} from './JobLogFileProcessor';

interface JobLogStreamOptions extends TransportStreamOptions {
  file_options?: StreamOptions<ReadStream>;
  zippedArchive?: boolean;
  extension?: string;
  dirname: string;
  filename: string;
  eol?: string;
}

function isValidFileName(filename) {
  // eslint-disable-next-line no-control-regex
  return !/["<>|:*?\\/\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f]/g.test(filename);
}

function isValidDirName(dirname) {
  // eslint-disable-next-line no-control-regex
  return !/["<>|\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f]/g.test(dirname);
}

const loggerDefaults: { file_options: any, eol: string } = {
  file_options: { flags: 'a' },
  eol: os.EOL,
};

export class JobLogFile extends Transport {
  name = 'jobLogFile';

  private options: JobLogStreamOptions;
  private dirname: string;
  private filename: string;

  constructor(options: JobLogStreamOptions) {
    super(options);

    this.options = { ...loggerDefaults, ...options };

    this.filename = options.filename;
    this.dirname = options.dirname;

    if (!isValidFileName(this.filename) || !isValidDirName(this.dirname)) {
      throw new Error('Your path or filename contain an invalid character.');
    }
  }

  log(info, callback) {
    if (info?.jobId) {
      const logStream = this.getLogStream(info.driveId, info.jobId);
      logStream.write(JSON.stringify(info) + this.options.eol);
      logStream.close();
      this.emit('logged', info);
    }

    if (callback) {
      callback(null, true);
    }
  }

  async close() {
    this.emit('finish');
  }

  getLogStream(driveId: string, jobId: string) {
    driveId = driveId || '';

    const dirname = this.dirname
      .replace('%driveId%', driveId)
      .replace('%jobId%', jobId)
      .replace('//', '/');

    fs.mkdirSync(dirname, { recursive: true });

    const filename = path.join(dirname, this.filename)
      .replace(/%JOB_ID%/g, jobId);
    return fs.createWriteStream(filename, this.options.file_options);
  }

  async query(options, callback) {
    if (!this.filename) {
      throw new Error('query() may not be used when initializing with a stream');
    }

    options = options || {};

    if (!options.jobId || !options.driveId) {
      callback(null, []);
      return [];
    }

    options.order = options.order || 'desc';

    const dirname = this.dirname
      .replace('%driveId%', options.driveId)
      .replace('%jobId%', options.jobId)
      .replace('//', '/');

    fs.mkdirSync(dirname, { recursive: true });

    const filename = path.join(dirname, this.filename)
      .replace(/%JOB_ID%/g, options.jobId);

    try {
      const processor = new JobLogFileProcessor(filename, options);
      const results = await processor.query();
      callback(null, results);
      return results;
    } catch (err) {
      callback(err);
      throw err;
    }
  }

}

