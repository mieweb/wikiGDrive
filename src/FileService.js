'use strict';

const fs = require('fs');

export class FileService {

  readFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, function(err, data) {
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
    })
  }

}
