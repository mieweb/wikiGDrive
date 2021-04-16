'use strict';

import fetch from 'node-fetch';
import * as crypto from 'crypto';
import {retryAsync} from './retryAsync';

export class HttpError extends Error {
  constructor(statusText, private code: number) {
    super(statusText);
  }
}

export class HttpClient {

  downloadUrl(url: string, writeStream) {
    return retryAsync(10, (resolve, reject) => {
      fetch(url)
        .then(res => {
          if (res.status >= 400) {
            throw new HttpError(res.statusText, res.status);
          }

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

  async md5Url(url): Promise<string> {
    const hash = crypto.createHash('md5');
    hash.setEncoding('hex');
    await this.downloadUrl(url, hash);
    hash.end();
    return hash.read();
  }

}
