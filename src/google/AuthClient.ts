'use strict';

import {google} from 'googleapis';

export class QuotaAuthClient extends google.auth.OAuth2 {
  constructor(client_id?: string, client_secret?: string, redirect_uri?: string) {
    super(client_id, client_secret, redirect_uri);
  }
}

export class QuotaJwtClient extends google.auth.JWT {
  constructor(optionsOrEmail?: string, keyFile?: string, key?: string, scopes?: string | string[], subject?: string, keyId?: string) {
    super(optionsOrEmail, keyFile, key, scopes, subject, keyId);
  }
}
