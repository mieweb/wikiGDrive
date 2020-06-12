'use strict';

import { google } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDocsServiceError extends Error {
  constructor(msg, { file, dest, isQuotaError }) {
    super(msg);
    this.file = file;
    this.dest = dest;
    this.isQuotaError = isQuotaError;
  }
}

export class GoogleDocsService {

  async download(auth, file, dest) {
    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      const docs = google.docs({ version: 'v1', auth });

      try {
        const res = await docs.documents.get({ documentId: file.id });
        console.log('Downloaded document: ' + file.id + '.gdoc [' + file.localPath + ']');

        const readable = new Readable();

        let stream = readable
          .on('end', () => {})
          .on('error', err => {
            reject(err);
          });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            resolve();
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            resolve();
          });
        }

        readable.push(JSON.stringify(res.data, null, 2));
        readable.push(null);
      } catch (err) {
        reject(new GoogleDocsServiceError('Error downloading file: ' + file.id, { file, dest, isQuotaError: err.isQuotaError }));
      }
    });
  }

}
