'use strict';

import { google } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDocsServiceError extends Error {
  private file: any;
  private dest: any;
  private isQuotaError: boolean;
  private origError: Error;

  constructor(msg, { origError, file, dest, isQuotaError }) {
    super(msg);
    this.file = file;
    this.dest = dest;
    this.origError = origError;
    this.isQuotaError = isQuotaError;
  }
}

export class GoogleDocsService {

  async download(auth, file, dest) {
    const docs = google.docs({ version: 'v1', auth });

    try {
      const res = await docs.documents.get({ documentId: file.id });
      const readable = new Readable();

      await new Promise((resolve, reject) => {
        let stream = readable
            .on('end', () => {})
            .on('error', err => {
              console.error(err);
              reject(err);
            });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            console.log('Downloaded document: ' + file.id + '.gdoc [' + file.localPath + ']');
            resolve();
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            console.log('Downloaded document: ' + file.id + '.gdoc [' + file.localPath + ']');
            resolve();
          });
        }

        readable.push(JSON.stringify(res.data, null, 2));
        readable.push(null);
      });

    } catch (err) {
      if (!err.isQuotaError) {
        console.error(err);
      }
      throw new GoogleDocsServiceError('Error downloading file: ' + file.id, { file, origError: err, dest, isQuotaError: err.isQuotaError });
    }
  }

}
