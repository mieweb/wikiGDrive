'use strict';

import {google} from 'googleapis';
import {JWT} from 'google-auth-library';
import {handleGoogleError} from './error';

export class QuotaAuthClient extends google.auth.OAuth2 {
  constructor(options) {
    super(options);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  async requestAsync(opts, retry = false) {
    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      const job = async () => {
        try {
          const response = await super.requestAsync(opts, retry);
          resolve(response);
        } catch (originalErr) {
          await handleGoogleError(originalErr, (err) => {
            reject(err);
            throw err;
          }, 'QuotaAuthClient');
        }
      };
      this.quotaLimiter.addJob(job);
    });
  }
}

export class QuotaJwtClient extends JWT {
  constructor(optionsOrEmail, keyFile, key, scopes, subject, keyId) {
    super(optionsOrEmail, keyFile, key, scopes, subject, keyId);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  async requestAsync(opts, retry = false) {
    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      const job = async () => {
        try {
          const response = await super.requestAsync(opts, retry);
          resolve(response);
        } catch (originalErr) {
          await handleGoogleError(originalErr, (err) => {
            reject(err);
            throw err;
          }, 'QuotaJwtClient');
        }
      };

      if (opts.url.endsWith('drive/v3/files')) {
        job.skipCounter = true;
      }

      this.quotaLimiter.addJob(job);
    });
  }
}
