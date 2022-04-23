/*!
 * FileStreamRotator
 * Copyright(c) 2012-2017 Holiday Extras.
 * Copyright(c) 2017 Roger C.
 * MIT Licensed
 */

import fs, {ReadStream, WriteStream} from 'fs';
import path from 'path';
import moment from 'moment';
import crypto from 'crypto';
import EventEmitter from 'events';
import util from 'util';
import {StreamOptions} from 'stream';
import dayjs from 'dayjs';

/**
 * FileStreamRotator:
 *
 * Returns a file stream that auto-rotates based on date.
 *
 * Options:
 *
 *   - `filename`       Filename including full path used by the stream
 *
 *   - `frequency`      How often to rotate. Options are 'daily', 'custom' and 'test'. 'test' rotates every minute.
 *                      If frequency is set to none of the above, a YYYYMMDD string will be added to the end of the filename.
 *
 *   - `verbose`        If set, it will log to STDOUT when it rotates files and name of log file. Default is TRUE.
 *
 *   - `date_format`    Format as used in moment.js http://momentjs.com/docs/#/displaying/format/. The result is used to replace
 *                      the '%DATE%' placeholder in the filename.
 *                      If using 'custom' frequency, it is used to trigger file change when the string representation changes.
 *
 *   - `size`           Max size of the file after which it will rotate. It can be combined with frequency or date format.
 *                      The size units are 'k', 'm' and 'g'. Units need to directly follow a number e.g. 1g, 100m, 20k.
 *
 *   - `max_logs`       Max number of logs to keep. If not set, it won't remove past logs. It uses its own log audit file
 *                      to keep track of the log files in a json format. It won't delete any file not contained in it.
 *                      It can be a number of files or number of days. If using days, add 'd' as the suffix.
 *
 *   - `audit_file`     Location to store the log audit file. If not set, it will be stored in the root of the application.
 *
 *   - `end_stream`     End stream (true) instead of the default behaviour of destroy (false). Set value to true if when writing to the
 *                      stream in a loop, if the application terminates or log rotates, data pending to be flushed might be lost.
 *
 *   - `file_options`   An object passed to the stream. This can be used to specify flags, encoding, and mode.
 *                      See https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options. Default `{ flags: 'a' }`.
 *
 *   - `utc`            Use UTC time for date in filename. Defaults to 'FALSE'
 *
 *   - `extension`      File extension to be appended to the filename. This is useful when using size restrictions as the rotation
 *                      adds a count (1,2,3,4,...) at the end of the filename when the required size is met.
 *
 *   - `watch_log`      Watch the current file being written to and recreate it in case of accidental deletion. Defaults to 'FALSE'
 *
 *   - `create_symlink` Create a tailable symlink to the current active log file. Defaults to 'FALSE'
 *
 *   - `symlink_name`   Name to use when creating the symbolic link. Defaults to 'current.log'
 *
 *   - `audit_hash_type` Use specified hashing algorithm for audit. Defaults to 'md5'. Use 'sha256' for FIPS compliance.
 *
 * To use with Express / Connect, use as below.
 *
 * const rotatingLogStream from 'FileStreamRotator').getStream({filename:"/tmp/test.log", frequency:"daily", verbose: false})
 * app.use(express.logger({stream: rotatingLogStream, format: "default"}));
 *
 * @param {Object} options
 * @return {Object}
 * @api public
 */

export class FileStreamRotator extends EventEmitter {
  private readonly frequencyMetaData: boolean | { type: any; digit: number };
  private readonly verbose: boolean;
  private readonly fileSize: number;
  private readonly filename: string;
  private readonly dateFormat: string;
  private readonly file_options: StreamOptions<ReadStream>;
  private fileCount: number;
  private curSize: number;
  private curDate: string;
  private oldFile: string;
  private logfile: string;
  private rotateStream: WriteStream;
  private auditLog: any;

  constructor(private readonly options) {
    super();

    this.frequencyMetaData = options.frequency ? getFrequency(options.frequency) : null;

    const auditLog = setAuditLog(options.max_logs, options.audit_file, options.filename);
    // Thanks to Means88 for PR.
    if (auditLog != null) {
      auditLog.hashType = (options.audit_hash_type !== undefined ? options.audit_hash_type : 'md5');
    }
    this.verbose = (options.verbose !== undefined ? options.verbose : true);

    this.curDate = null;

    this.fileCount = 0;
    this.curSize = 0;
    this.fileSize = options.size ? parseFileSize(options.size) : null;

    this.dateFormat = (options.date_format || DATE_FORMAT);
    if (this.frequencyMetaData && this.frequencyMetaData.type === 'daily') {
      if (!options.date_format) {
        this.dateFormat = 'YYYY-MM-DD';
      }
      if (moment().format(this.dateFormat) != moment().endOf('day').format(this.dateFormat) ||
        moment().format(this.dateFormat) == moment().add(1,'day').format(this.dateFormat)) {
        if (this.verbose) {
          console.log(new Date(), '[FileStreamRotator] Changing type to custom as date format changes more often than once a day or not every day');
        }
        this.frequencyMetaData.type = 'custom';
      }
    }

    if (this.frequencyMetaData) {
      this.curDate = (options.frequency ? getDate(this.frequencyMetaData, this.dateFormat) : '');
    }

    options.create_symlink = options.create_symlink || false;
    options.extension = options.extension || '';
    this.filename = options.filename;
    this.oldFile = null;
    this.logfile = this.filename + (this.curDate ? '.' + this.curDate : '');
    if (this.filename.match(/%DATE%/)) {
      this.logfile = this.filename.replace(/%DATE%/g, (this.curDate ? this.curDate : getDate(null, this.dateFormat)));
    }

    if (this.fileSize) {
      let lastLogFile = null;
      let t_log = this.logfile;
      if (auditLog && auditLog.files && auditLog.files instanceof Array && auditLog.files.length > 0) {
        const lastEntry = auditLog.files[auditLog.files.length - 1].name;
        if (lastEntry.match(t_log)) {
          const lastCount = lastEntry.match(t_log + '\\.(\\d+)');
          if (lastCount) {
            t_log = lastEntry;
            this.fileCount = lastCount[1];
          }
        }
      }

      if (this.fileCount == 0 && t_log == this.logfile) {
        t_log += options.extension;
      }

      while (fs.existsSync(t_log)) {
        lastLogFile = t_log;
        this.fileCount++;
        t_log = this.logfile + '.' + this.fileCount + options.extension;
      }
      if (lastLogFile) {
        const lastLogFileStats = fs.statSync(lastLogFile);
        if (lastLogFileStats.size < this.fileSize) {
          t_log = lastLogFile;
          this.fileCount--;
          this.curSize = lastLogFileStats.size;
        }
      }
      this.logfile = t_log;
    } else {
      this.logfile += options.extension;
    }

    if (this.verbose) {
      console.log(new Date(), '[FileStreamRotator] Logging to: ', this.logfile);
    }
    if (this.verbose) {
      console.log(new Date(), '[FileStreamRotator] Rotating file: ',
        this.frequencyMetaData ? this.frequencyMetaData.type : '',
        this.fileSize ? 'size: ' + this.fileSize : ''
      );
    }

    this.file_options = options.file_options || { flags: 'a' };

    this.on('createLog', (file) => {
      try {
        fs.lstatSync(file);
      } catch (err) {
        if (this.rotateStream && typeof this.rotateStream.end === 'function') {
          this.rotateStream.end();
        }

        this.setWriteStream(file);
        this.emit('new', file);
      }
    });

    mkDirForFile(this.logfile);
    this.setWriteStream(this.logfile);

    this.on('close', () => {
      if (logWatcher) {
        logWatcher.close();
      }
    });

    this.on('new', (newLog) => {
      this.addLogToAudit(newLog, this.verbose);
      if (options.create_symlink) {
        createCurrentSymLink(newLog, options.symlink_name, this.verbose);
      }
      if (options.watch_log) {
        this.emit('addWatcher', newLog);
      }
    });

    let logWatcher;
    this.on('addWatcher', (newLog) => {
      if (logWatcher) {
        logWatcher.close();
      }
      if (!options.watch_log) {
        return;
      }
      logWatcher = createLogWatcher(newLog, this.verbose, (err, newLog) => {
        this.emit('createLog', newLog);
      });
    });

    process.nextTick(() => {
      this.emit('new', this.logfile);
    });
    this.emit('new', this.logfile);
  }

  end(...args) {
    this.rotateStream.end(...args);
  }

  write(str, encoding) {
    const newDate = this.frequencyMetaData ? getDate(this.frequencyMetaData, this.dateFormat) : this.curDate;
    if (newDate != this.curDate || (this.fileSize && this.curSize > this.fileSize)) {
      let newLogfile = this.filename + (this.curDate && this.frequencyMetaData ? '.' + newDate : '');
      if (this.filename.match(/%DATE%/) && this.curDate) {
        newLogfile = this.filename.replace(/%DATE%/g, newDate);
      }

      if (this.fileSize && this.curSize > this.fileSize) {
        this.fileCount++;
        newLogfile += '.' + this.fileCount + this.options.extension;
      } else {
        // reset file count
        this.fileCount = 0;
        newLogfile += this.options.extension;
      }
      this.curSize = 0;

      if (this.verbose) {
        console.log(new Date(), util.format('[FileStreamRotator] Changing logs from %s to %s', this.logfile, newLogfile));
      }
      this.curDate = newDate;
      this.oldFile = this.logfile;
      this.logfile = newLogfile;
      // Thanks to @mattberther https://github.com/mattberther for raising it again.
      if (this.options.end_stream === true) {
        this.rotateStream.end();
      } else {
        this.rotateStream.destroy();
      }

      mkDirForFile(this.logfile);

      this.setWriteStream(newLogfile);
      this.emit('new', newLogfile);
      this.emit('rotate', this.oldFile, newLogfile);
    }
    this.rotateStream.write(str, encoding);
    // Handle length of double-byte characters
    this.curSize += Buffer.byteLength(str, encoding);
  }

  addLogToAudit(newLog, verbose) {
    this.auditLog = addLogToAudit(newLog, this.auditLog, this, verbose);
  }

  setWriteStream(logfile: string) {
    this.rotateStream = fs.createWriteStream(logfile, this.file_options);
    this.rotateStream.on('close', () => {
      this.emit('close');
    });
    this.rotateStream.on('finish', () => {
      this.emit('finish');
    });
    this.rotateStream.on('error', (err) => {
      this.emit('error',err);
    });
    this.rotateStream.on('open', (fd) => {
      this.emit('open',fd);
    });
  }
}

const DATE_FORMAT = 'YYYYMMDDHHmm';

/**
 * Returns frequency metadata for minute/hour rotation
 * @param type
 * @param num
 * @returns {*}
 * @private
 */
function _checkNumAndType(type, num) {
  if (typeof num == 'number') {
    switch (type) {
      case 'm':
        if (num < 0 || num > 60) {
          return false;
        }
        break;
      case 'h':
        if (num < 0 || num > 24) {
          return false;
        }
        break;
    }
    return {type: type, digit: num};
  }
}


/**
 * Returns frequency metadata for defined frequency
 * @param freqType
 * @returns {*}
 * @private
 */
function _checkDailyAndTest(freqType) {
  switch (freqType) {
    case 'custom':
    case 'daily':
      return {type: freqType, digit: undefined};
    case 'test':
      return {type: freqType, digit: 0};
  }
  return false;
}

/**
 * Returns frequency metadata
 * @param frequency
 * @returns {*}
 */
export function getFrequency(frequency) {
  const _f = frequency.toLowerCase().match(/^(\d+)([mh])$/);
  if (_f) {
    return _checkNumAndType(_f[2], parseInt(_f[1]));
  }

  const dailyOrTest = _checkDailyAndTest(frequency);
  if (dailyOrTest) {
    return dailyOrTest;
  }

  return false;
}

/**
 * Returns a number based on the option string
 * @param size
 * @returns {Number}
 */
function parseFileSize(size) {
  if (size && typeof size == 'string') {
    const _s = size.toLowerCase().match(/^((?:0\.)?\d+)([kmg])$/);
    if (_s) {
      const s1 = parseInt(_s[1]);
      switch(_s[2]) {
        case 'k':
          return s1 * 1024;
        case 'm':
          return s1 * 1024 * 1024;
        case 'g':
          return s1 * 1024 * 1024 * 1024;
      }
    }
  }
  return null;
}

const staticFrequency = ['daily', 'test', 'm', 'h', 'custom'];

/**
 * Returns date string for a given format / date_format
 * @param format
 * @param date_format
 * @param {boolean} utc
 * @returns {string}
 */
function getDate(format, date_format) {
  date_format = date_format || DATE_FORMAT;
  const currentMoment = dayjs();
  if (format && staticFrequency.indexOf(format.type) !== -1) {
    switch (format.type) {
      case 'm':
        {
          const minute = Math.floor(currentMoment.minute() / format.digit) * format.digit;
          return currentMoment.minute(minute).format(date_format);
        }
      case 'h':
        {
          const hour = Math.floor(currentMoment.hour() / format.digit) * format.digit;
          return currentMoment.hour(hour).format(date_format);
        }
      case 'daily':
      case 'custom':
      case 'test':
        return currentMoment.format(date_format);
    }
  }
  return currentMoment.format(date_format);
}

/**
 * Read audit json object from disk or return new object or null
 * @param max_logs
 * @param audit_file
 * @param log_file
 * @returns {Object} auditLogSettings
 * @property {Object} auditLogSettings.keep
 * @property {Boolean} auditLogSettings.keep.days
 * @property {Number} auditLogSettings.keep.amount
 * @property {String} auditLogSettings.auditLog
 * @property {Array} auditLogSettings.files
 * @property {String} auditLogSettings.hashType
 */
function setAuditLog(max_logs, audit_file, log_file) {
  let _rtn = null;
  if (max_logs) {
    const use_days = max_logs.toString().substr(-1);
    const _num = max_logs.toString().match(/^(\d+)/);

    if (Number(_num[1]) > 0) {
      const baseLog = path.dirname(log_file.replace(/%DATE%.+/, '_filename'));
      try{
        if (audit_file) {
          const full_path = path.resolve(audit_file);
          _rtn = JSON.parse(fs.readFileSync(full_path, { encoding: 'utf-8' }));
        } else {
          const full_path = path.resolve(baseLog + '/' + '.audit.json');
          _rtn = JSON.parse(fs.readFileSync(full_path, { encoding: 'utf-8' }));
        }
      } catch(e) {
        if (e.code !== 'ENOENT') {
          return null;
        }
        _rtn = {
          keep: {
            days: false,
            amount: Number(_num[1])
          },
          auditLog: audit_file || baseLog + '/.audit.json',
          files: []
        };
      }

      _rtn.keep = {
        days: use_days === 'd',
        amount: Number(_num[1])
      };

    }
  }
  return _rtn;
}


/**
 * Write audit json object to disk
 * @param {Object} audit
 * @param {Object} audit.keep
 * @param {Boolean} audit.keep.days
 * @param {Number} audit.keep.amount
 * @param {String} audit.auditLog
 * @param {Array} audit.files
 * @param {String} audit.hashType
 * @param {Boolean} verbose
 */
function writeAuditLog(audit, verbose) {
  try {
    mkDirForFile(audit.auditLog);
    fs.writeFileSync(audit.auditLog, JSON.stringify(audit,null,4));
  } catch (e) {
    if (verbose) {
      console.error(new Date(), '[FileStreamRotator] Failed to store log audit at:', audit.auditLog, 'Error:', e);
    }
  }
}

/**
 * Removes old log file
 * @param file
 * @param file.hash
 * @param file.name
 * @param file.date
 * @param file.hashType
 * @param {Boolean} verbose
 */
function removeFile(file, verbose) {
  if (file.hash === crypto.createHash(file.hashType).update(file.name + 'LOG_FILE' + file.date).digest('hex')) {
    try {
      if (fs.existsSync(file.name)) {
        fs.unlinkSync(file.name);
      }
    } catch(e) {
      if (verbose) {
        console.error(new Date(), '[FileStreamRotator] Could not remove old log file: ', file.name);
      }
    }
  }
}

/**
 * Create symbolic link to current log file
 * @param {String} logfile
 * @param {String} name Name to use for symbolic link
 * @param {Boolean} verbose
 */
function createCurrentSymLink(logfile, name, verbose) {
  const symLinkName = name || 'current.log';
  const logPath = path.dirname(logfile);
  const logfileName = path.basename(logfile);
  const current = logPath + '/' + symLinkName;
  try {
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(current);
      fs.symlinkSync(logfileName, current);
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      try {
        fs.symlinkSync(logfileName, current);
      } catch (e) {
        if (verbose) {
          console.error(new Date(), '[FileStreamRotator] Could not create symlink file: ', current, ' -> ', logfileName);
        }
      }
    }
  }
}

/**
 *
 * @param {String} logfile
 * @param {Boolean} verbose
 * @param {function} cb
 */
function createLogWatcher(logfile, verbose, cb) {
  if (!logfile) return null;
  // console.log("Creating log watcher")
  try {
    const stats = fs.lstatSync(logfile);
    return fs.watch(logfile, (event,filename) => {
      // console.log(Date(), event, filename)
      if (event == 'rename') {
        try {
          const stats = fs.lstatSync(logfile);
          // console.log('STATS:', stats);
        } catch(err) {
          // console.log("ERROR:", err);
          cb(err,logfile);
        }
      }
    });
  } catch(err) {
    if (verbose) {
      console.log(new Date(), '[FileStreamRotator] Could not add watcher for ' + logfile);
    }
  }
}

/**
 * Write audit json object to disk
 * @param {String} logfile
 * @param {Object} audit
 * @param {Object} audit.keep
 * @param {Boolean} audit.keep.days
 * @param {Number} audit.keep.amount
 * @param {String} audit.auditLog
 * @param {String} audit.hashType
 * @param {Array} audit.files
 * @param {EventEmitter} stream
 * @param {Boolean} verbose
 */
function addLogToAudit(logfile, audit, stream, verbose) {
  if (audit && audit.files) {
    // Based on contribution by @nickbug - https://github.com/nickbug
    const index = audit.files.findIndex((file) => {
      return (file.name === logfile);
    });
    if (index !== -1) {
      // nothing to do as entry already exists.
      return audit;
    }
    const time = Date.now();
    audit.files.push({
      date: time,
      name: logfile,
      hash: crypto.createHash(audit.hashType).update(logfile + 'LOG_FILE' + time).digest('hex')
    });

    if (audit.keep.days) {
      const oldestDate = moment().subtract(audit.keep.amount,'days').valueOf();
      const recentFiles = audit.files.filter((file) => {
        if (file.date > oldestDate) {
          return true;
        }
        file.hashType = audit.hashType;
        removeFile(file, verbose);
        stream.emit('logRemoved', file);
        return false;
      });
      audit.files = recentFiles;
    } else {
      const filesToKeep = audit.files.splice(-audit.keep.amount);
      if (audit.files.length > 0) {
        audit.files.filter((file) => {
          file.hashType = audit.hashType;
          removeFile(file, verbose);
          stream.emit('logRemoved', file);
          return false;
        });
      }
      audit.files = filesToKeep;
    }
    writeAuditLog(audit, verbose);
  }

  return audit;
}

/**
 * Check and make parent directory
 * @param pathWithFile
 */
function mkDirForFile(pathWithFile) {
  const _path = path.dirname(pathWithFile);
  _path.split(path.sep).reduce(
    (fullPath, folder) => {
      fullPath += folder + path.sep;
      if (!fs.existsSync(fullPath)) {
        try {
          fs.mkdirSync(fullPath);
        } catch(e) {
          if (e.code !== 'EEXIST') {
            throw e;
          }
        }
      }
      return fullPath;
    },
    ''
  );
}
