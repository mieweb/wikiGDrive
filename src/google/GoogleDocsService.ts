'use strict';

import { google } from 'googleapis';
import { Readable } from 'stream';
import {GoogleFile} from '../storage/GoogleFilesStorage';

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

  constructor(private logger) {}

  async download(auth, file: GoogleFile, dest) {
    const docs = google.docs({ version: 'v1', auth });

    try {
      const res = await docs.documents.get({ documentId: file.id });
      const readable = new Readable();

      await new Promise<void>((resolve, reject) => {
        let stream = readable
            .on('error', err => {
              this.logger.error('Download stream error', err);
              reject(err);
            });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            this.logger.info('Downloaded document: ' + file.id + '.gdoc [' + file.name + ']');
            resolve();
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            this.logger.info('Downloaded document: ' + file.id + '.gdoc [' + file.name + ']');
            resolve();
          });
        }

        readable.push(JSON.stringify(res.data, null, 2));
        readable.push(null);
      });

    } catch (err) {
      if (!err.isQuotaError) {
        this.logger.error('Download error', err);
      }
      throw new GoogleDocsServiceError('Error downloading file: ' + file.id, { file, origError: err, dest, isQuotaError: err.isQuotaError });
    }
  }

}
