'use strict';

import fs from 'fs';
import crypto from 'crypto';

export class FileService {

  exists(filePath) {
    return new Promise((resolve) => {
      fs.exists(filePath, (exists) => {
        resolve(exists);
      });
    });
  }

  readFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, function (err, data) {
        if (err) return reject(err);

        resolve(data.toString());
      });
    });
  }

  writeFile(filePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  md5File(filePath) {
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

  async move(path1, path2) {
    fs.renameSync(path1, path2);
  }

}
