'use strict';

import {google} from 'googleapis';
import {JWT} from 'google-auth-library';

export class QuotaAuthClient extends google.auth.OAuth2 {
  constructor(options) {
    super(options);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  requestAsync(opts, retry = false) {
    return new Promise(((resolve, reject) => {
      this.quotaLimiter.addJob(() => {
        try {
          resolve(super.requestAsync(opts, retry));
        } catch (err) {
          console.error('xxxxxx', err);
          if (err.error && err.error.message && err.error.message.indexOf('User Rate Limit Exceeded') > -1) {
            console.log('RATE');
            // TODO slow down
          }
          reject(err);
        }
      });
    }));
  }
}

export class QuotaJwtClient extends JWT {
  constructor(optionsOrEmail, keyFile, key, scopes, subject, keyId) {
    super(optionsOrEmail, keyFile, key, scopes, subject, keyId);
  }

  setQuotaLimiter(quotaLimiter) {
    this.quotaLimiter = quotaLimiter;
  }

  requestAsync(opts, retry = false) {
    return new Promise(((resolve, reject) => {
      this.quotaLimiter.addJob(() => {
        try {
          resolve(super.requestAsync(opts, retry));
        } catch (err) {
          console.error('xxxxxx', err);
          if (err.error && err.error.message && err.error.message.indexOf('User Rate Limit Exceeded') > -1) {
            console.log('RATE');
            // TODO slow down
          }
          reject(err);
        }
      });
    }));
  }
}
