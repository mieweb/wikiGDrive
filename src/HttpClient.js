'use strict';

import fetch from 'node-fetch';
import crypto from 'crypto';

export class HttpClient {

  downloadUrl(url, writeStream) {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then(res => {
          res.body
            .on('error', (err) => {
              reject(err);
            })
            .on('end', () => {
              resolve();
            })
            .pipe(writeStream)
        })
    });
  }

  async md5Url(url) {
    const hash = crypto.createHash('md5');
    hash.setEncoding('hex');
    await this.downloadUrl(url, hash);
    hash.end();
    return hash.read();
  }

}
