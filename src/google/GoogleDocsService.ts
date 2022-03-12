'use strict';

import { google } from 'googleapis';
import {Readable, Stream, Writable} from 'stream';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {GoogleFile, SimpleFile} from '../model/GoogleFile';

export class GoogleDocsServiceError extends Error {
  private file: GoogleFile;
  private isQuotaError: boolean;
  private origError: Error;

  constructor(msg, { origError, file, isQuotaError }) {
    super(msg);
    this.file = file;
    this.origError = origError;
    this.isQuotaError = isQuotaError;
  }
}

export class GoogleDocsService {

  constructor(private logger) {}

  async download(auth: OAuth2Client, file: SimpleFile, dest: Writable | Writable[]) {
    const docs = google.docs({ version: 'v1', auth });

    try {
      const res = await docs.documents.get({ documentId: file.id });
      const readable = new Readable();

      await new Promise<void>((resolve, reject) => {
        let stream: Stream = readable
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
      throw new GoogleDocsServiceError('Error downloading file: ' + file.id, { file, origError: err, isQuotaError: err.isQuotaError });
    }
  }

}
