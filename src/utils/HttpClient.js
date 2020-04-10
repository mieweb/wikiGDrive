'use strict';

import fetch from 'node-fetch';
import crypto from 'crypto';
import {retryAsync} from './retryAsync';

export class HttpClient {

  downloadUrl(url, writeStream) {
    return retryAsync(10, (resolve, reject) => {
      fetch(url)
        .then(res => {
          res.body
            .on('error', (err) => {
              reject(err);
            })
            .on('end', () => {
              resolve();
            })
            .pipe(writeStream);
        })
        .catch(err => {
          reject(err);
        });
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
