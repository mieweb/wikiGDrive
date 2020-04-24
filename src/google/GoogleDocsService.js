'use strict';

import { google } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDocsService {

  async download(auth, file, dest, ) {
    return new Promise((resolve, reject) => {
      const docs = google.docs({ version: 'v1', auth });

      docs.documents
        .get({
          documentId: file.id
        }, async (err, res) => {
          if (err) {
            if (parseInt(err.code) === 403) { // Retry
              if (err.config && err.config.url) {
                console.error('Forbidden', err.config.url);
              }
              if (err.response && err.response.data) {
                const chunks = [];
                for await (const chunk of err.response.data) {
                  chunks.push(chunk);
                }
                const errorData = Buffer.concat(chunks).toString();
                console.log(errorData);
                reject(new Error(errorData));
                return;
              }
            }
            console.error(err);
            console.log('res', res);

            reject(err);
            return;
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
