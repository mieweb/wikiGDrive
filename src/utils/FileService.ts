'use strict';

import * as fs from 'fs';
import * as crypto from 'crypto';

export class FileService {

  exists(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      fs.exists(filePath, (exists) => {
        resolve(exists);
      });
    });
  }

  getSize(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      const stats = fs.statSync(filePath);
      resolve(stats.size);
    });
  }

  readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, function (err, data) {
        if (err) return reject(err);

        resolve(data.toString());
      });
    });
  }

  writeFile(filePath: string, content: string) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  md5File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      hash.setEncoding('hex');

      const fd = fs.createReadStream(filePath);
      fd
        .on('error', function (err) {
          reject(err);
        })
        .on('end', function () {
          hash.end();
          resolve(hash.read()); // the desired sha1sum
        });

      fd.pipe(hash);
    });
  }

  async move(path1: string, path2: string) {
    fs.renameSync(path1, path2);
  }

  async remove(filePath) {
    fs.unlinkSync(filePath);
  }

}
