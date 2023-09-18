'use strict';

import {convertResponseToError, GoogleDriveServiceError} from './driveFetch';
import {ServiceAccountJson} from '../model/AccountJson';
import jsonwebtoken from 'jsonwebtoken';
import {AuthError, GoogleUser} from '../containers/server/auth';
import open from 'open';
import readline from 'readline';
import {promisify} from 'util';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly',
  // 'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export interface GoogleAuth {
  refresh_token: string | null;
  expiry_date: number | null;
  access_token: string | null;
  token_type?: string | null;
  id_token?: string | null;
  scopes: string[];
}

export interface HasAccessToken {
  getAccessToken(): Promise<string>;
}

// https://developers.google.com/identity/protocols/oauth2/web-server

async function refreshToken(client_id: string, client_secret: string, refresh_token: string): Promise<GoogleAuth> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:	'refresh_token',
      client_id,
      client_secret,
      refresh_token
    }).toString()
  });
  const json = await response.json();

  return {
    access_token: json.access_token ? json.access_token.trim() : undefined,
    refresh_token,
    expiry_date: new Date().getTime() + Math.floor((json.expires_in - 60) * 1000),
    scopes: json.scope ? json.scope.split(' ') : [],
    token_type: json.token_type
  };
}

export async function getCliCode(client_id: string): Promise<string> {
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id,
    // redirect_uri: ,
    // response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    scope: SCOPES.join(' '),
  }).toString();

  const child = await open(authUrl, { wait: true });
  child.stdout.on('data', (data) => {
    console.log(`Received chunk ${data}`);
  });
  child.stderr.on('data', (data) => {
    console.log(`Received err ${data}`);
  });
  child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
  child.on('message', (m) => {
    console.log('PARENT got message:', m);
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = promisify(rl.question).bind(rl);
  const code = await question('Enter the code from that page here: ');
  rl.close();

  return code;
}

export class UserAuthClient implements HasAccessToken {

  private access_token: string;
  private refresh_token: string;
  private expiry_date: number;

  constructor(private client_id: string, private client_secret: string) {
    if (!client_id) throw new Error('Unknown: client_id');
    if (!client_secret) throw new Error('Unknown: client_secret');
  }

  async revokeToken(access_token: string) {
    const response = await fetch('https://oauth2.googleapis.com/revoke?token=' + access_token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    return await response.json();
  }

  async getWebDriveInstallUrl(redirect_uri: string, state: string): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: this.client_id,
      redirect_uri,
      // access_type: 'offline',
      prompt: 'consent select_account',
      response_type: 'code',
      include_granted_scopes: 'true',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.install'
      ].join(' '),
      state
    }).toString();
  }

  async getWebDriveShareUrl(redirect_uri: string, state: string): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: this.client_id,
      redirect_uri,
      // access_type: 'offline',
      prompt: 'consent select_account',
      response_type: 'code',
      include_granted_scopes: 'true',
      scope: [
        'https://www.googleapis.com/auth/drive'
      ].join(' '),
      state
    }).toString();
  }

  async getUploadDriveUrl(redirect_uri: string, state: string): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: this.client_id,
      redirect_uri,
      // access_type: 'offline',
      prompt: 'consent select_account',
      response_type: 'code',
      include_granted_scopes: 'true',
      scope: [
        'https://www.googleapis.com/auth/drive.file'
      ].join(' '),
      state
    }).toString();
  }

  async getWebAuthUrl(redirect_uri: string, state: string): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: this.client_id,
      redirect_uri,
      access_type: 'offline', // https://developers.google.com/identity/protocols/oauth2/web-server#offline
      // prompt: 'consent',
      response_type: 'code',
      include_granted_scopes: 'true',
      scope: SCOPES.join(' '),
      state
    }).toString();
  }

  async authorizeResponseCode(code: string, redirect_uri: string): Promise<void> {
    const body = {
      client_id: this.client_id,
      client_secret: this.client_secret,
      redirect_uri: redirect_uri,
      access_type: 'offline',
      grant_type: 'authorization_code',
      code: code
    };

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(body).toString()
    });

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    const json = await response.json();

    const now = new Date().getTime();
    const expiry_date = now + Math.floor((json.expires_in - 60) * 1000);

    if (!json.refresh_token) {
      console.error('NOREF', json, body);
    }

    const scopes = (json.scope || '').split(' ');
    if (!scopes.includes('https://www.googleapis.com/auth/drive.readonly') || !scopes.includes('https://www.googleapis.com/auth/drive.metadata.readonly')) {
      await this.revokeToken(json.access_token);
      const err = new AuthError('Insufficient Permission: no access to drive, check all permissions during login', 403);
      err.showHtml = true;
      throw err;
    }

    const googleAuth: GoogleAuth = {
      access_token: json.access_token ? json.access_token.trim() : undefined,
      refresh_token: json.refresh_token ? json.refresh_token.trim() : undefined,
      scopes: json.scope ? json.scope.split(' ') : [],
      token_type: json.token_type,
      expiry_date,
      id_token: json.id_token
    };

    this.expiry_date = expiry_date;
    this.access_token = googleAuth.access_token;
    this.refresh_token = googleAuth.refresh_token;
  }

  async authorizeCookieData(access_token: string, refresh_token: string, expiry_date: number) {
    if (!access_token) {
      this.access_token = '';
      return;
    }

    this.access_token = access_token;
    this.refresh_token = refresh_token;
    this.expiry_date = expiry_date;

    await this.checkAccessToken();
  }

  async authorizeUserAccount(redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'): Promise<void> {
    // Service account

    // https://medium.com/@bretcameron/how-to-use-the-google-drive-api-with-javascript-57a6cc9e5262
    // const email = credentials.client_email;
    // const key = credentials.private_key;
    // const keyId = credentials.private_key_id;
    //
    // const oAuth2Client = new google.auth.JWT(email, null, key, SCOPES, keyId);
    //
    // console.log(oAuth2Client);
    // return oAuth2Client;


    // https://developers.google.com/identity/protocols/oauth2/service-account

    // Client name: Service Account Unique ID
    // API interfaces: https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/drive.metadata.readonly

    // https://www.daimto.com/how-to-get-a-google-access-token-with-curl/
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.client_id,
        client_secret: this.client_secret,
        redirect_uri
      }).toString()
    });
    const json = await response.json();

    this.access_token = json.access_token;
    this.refresh_token = json.refresh_token;
    this.expiry_date = json.expiry_date;
  }

  async checkAccessToken() {
    if (this.expiry_date) {
      const now = new Date().getTime();
      if (now - 600 > this.expiry_date) {
        if (this.refresh_token) {
          const googleAuth: GoogleAuth = await refreshToken(this.client_id, this.client_secret, this.refresh_token);
          this.expiry_date = googleAuth.expiry_date;
          this.access_token = googleAuth.access_token;
        }
      }
    }
  }

  async getAccessToken(): Promise<string> {
    await this.checkAccessToken();
    return this.access_token;
  }

  setCredentials(google_auth: GoogleAuth) {
    this.expiry_date = google_auth.expiry_date;
    this.refresh_token = google_auth.refresh_token;
    this.access_token = google_auth.access_token;
  }

  async getUser(access_token: string): Promise<GoogleUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?access_token=' + access_token);

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    const json = await response.json();
    return {
      id: json.id,
      email: json.email,
      name: json.name
    };
  }

  async getAuthData(): Promise<{ google_access_token: string, google_refresh_token: string, google_expiry_date: number }> {
    return {
      google_access_token: this.access_token,
      google_refresh_token: this.refresh_token,
      google_expiry_date: this.expiry_date,
    };
  }

}

export class ServiceAuthClient implements HasAccessToken {

  private access_token: string;
  private expiry_date: number;

  constructor(private readonly service_account_json: ServiceAccountJson) {
  }

  async fetchAccessToken() {
    // https://tanaikech.github.io/2019/04/02/retrieving-access-token-using-service-account-for-node.js-without-using-googleapis/
    const now = Math.floor(Date.now() / 1000);
    const url = 'https://www.googleapis.com/oauth2/v4/token';

    const jwt = jsonwebtoken.sign({
      iss: this.service_account_json.client_email,
      scope: SCOPES.join(' '),
      aud: url,
      exp: (now + 3600),
      iat: now,
    }, this.service_account_json.private_key, {
      algorithm: 'RS256'
    });

    const response = await fetch(url, {
      method: 'post',
      body: JSON.stringify({
        assertion: jwt,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      }),
    });
    const json = await response.json();
    /*
        {
          access_token: 'aaa.bbb.ccc',
          expires_in: 3599,
          token_type: 'Bearer'
        }
    */
    this.expiry_date = new Date().getTime() + Math.floor((json.expires_in - 60) * 1000);
    this.access_token = json.access_token ? json.access_token.trim() : undefined;
  }

  async getAccessToken(): Promise<string> {
    if (this.expiry_date) {
      const now = new Date().getTime();
      if (now - 600 > this.expiry_date) {
        await this.fetchAccessToken();
      }
    }

    if (!this.access_token) {
      await this.fetchAccessToken();
    }

    return this.access_token;
  }

}
