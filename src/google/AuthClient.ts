'use strict';

import {google} from 'googleapis';
import {handleGoogleError} from './error';
import {QuotaLimiter} from './QuotaLimiter';
import {GaxiosOptions, GaxiosResponse} from 'gaxios';

export interface HasQuotaLimiter {
  setQuotaLimiter(quotaLimiter: QuotaLimiter);
}

export class QuotaAuthClient extends google.auth.OAuth2 implements HasQuotaLimiter {
  private quotaLimiter: QuotaLimiter;

  constructor(client_id?: string, client_secret?: string, redirect_uri?: string) {
    super(client_id, client_secret, redirect_uri);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  async requestAsync(opts: GaxiosOptions, retry = false): Promise<GaxiosResponse> {
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

export class QuotaJwtClient extends google.auth.JWT implements HasQuotaLimiter {
  private quotaLimiter: QuotaLimiter;

  constructor(optionsOrEmail?: string, keyFile?: string, key?: string, scopes?: string | string[], subject?: string, keyId?: string) {
    super(optionsOrEmail, keyFile, key, scopes, subject, keyId);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  async requestAsync(opts: GaxiosOptions, retry = false): Promise<GaxiosResponse> {
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
