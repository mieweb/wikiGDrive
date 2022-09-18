'use strict';

import readline from 'readline';
import open from 'open';
import {promisify} from 'util';

import {HasQuotaLimiter, QuotaAuthClient, QuotaJwtClient} from './AuthClient';
import {GoogleAuth} from '../model/GoogleAuth';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {ServiceAccountJson} from '../model/AccountJson';
import fetch from 'node-fetch';
import crypto from 'crypto';
import {convertResponseToError} from './driveFetch';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// https://stackoverflow.com/questions/19641783/google-drive-api-username-password-authentication#19643080
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount
const IV = '5383165476e1c2e3';
export function encrypt(val: string, key: string) {
  key = new Buffer(key).toString('hex').substring(0, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, IV);
  const encrypted = cipher.update(val, 'utf8', 'base64');
  return encrypted + cipher.final('base64');
}

export function decrypt(encrypted: string, key: string) {
  if (!encrypted) {
    return null;
  }
  key = new Buffer(key).toString('hex').substring(0, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, IV);
  const decrypted = decipher.update(encrypted, 'base64', 'utf8');
  return decrypted + decipher.final('utf8');
}

export class GoogleAuthService {

  async authorizeServiceAccount(service_account_json: ServiceAccountJson): Promise<OAuth2Client & HasQuotaLimiter> {
    return new QuotaJwtClient(service_account_json.client_email, null, service_account_json.private_key, SCOPES);
  }

  async authorizeUserAccount(client_id: string, client_secret: string, redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'): Promise<OAuth2Client & HasQuotaLimiter> {
    if (!client_id) throw new Error('Unknown: client_id');
    if (!client_secret) throw new Error('Unknown: client_secret');

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

    return new QuotaAuthClient(client_id, client_secret, redirect_uri);
  }

  async getWebAuthUrl(client_id: string, redirect_uri: string, state: string): Promise<string> {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id,
      redirect_uri,
      access_type: 'offline',
      prompt: 'consent',
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive.readonly'
      ].join(' '),
      state
    }).toString();
  }

  async getWebToken(client_id: string, client_secret: string, redirect_uri: string, code: string): Promise<GoogleAuth> {
    const body = new URLSearchParams({
      client_id,
      client_secret,
      redirect_uri: redirect_uri,
      access_type: 'offline',
      grant_type: 'authorization_code',
      code: code
    }).toString();

    const response = await fetch('https://accounts.google.com/o/oauth2/token ', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body
    });

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    const json = await response.json();

    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      scope: json.scope,
      token_type: json.token_type,
      expiry_date: json.expiry_date,
      id_token: json.id_token
    };
  }

  async getCliAccessToken(client_id: string, client_secret: string): Promise<GoogleAuth> {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id,
      // redirect_uri: ,
      access_type: 'offline',
      // response_type: 'code',
      scope: SCOPES.join(' '),
    }).toString();


/*
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
*/

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

    // const credentials: GetTokenResponse = await oAuth2Client.getToken(code);

    return await this.getWebToken(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob', code);
  }

  async getUser(auth: {
    refresh_token: string;
    access_token: string }) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?access_token=' + auth.access_token);

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    const json = await response.json();
    return {
      id: json.id,
      email: json.email,
      name: json.name,
      google_access_token: auth.access_token,
      google_refresh_token: auth.refresh_token
    };
  }
}
