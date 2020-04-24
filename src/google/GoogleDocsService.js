'use strict';

import { google } from 'googleapis';
import { Readable } from 'stream';
import { handleGoogleError } from './error';

export class GoogleDocsService {

  async download(auth, file, dest, ) {
    return new Promise((resolve, reject) => {
      const docs = google.docs({ version: 'v1', auth });

      docs.documents
        .get({
          documentId: file.id
        }, async (err, res) => {
          if (err) {
            return handleGoogleError(err, reject);
          }

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
        });
    });
  }

}
