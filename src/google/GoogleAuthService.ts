'use strict';

import * as readline from 'readline';
import * as open from 'open';
import {promisify} from 'util';

import {HasQuotaLimiter, QuotaAuthClient, QuotaJwtClient} from './AuthClient';
import {GoogleAuth} from '../storage/ConfigService';
import {GetTokenResponse, OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {ServiceAccountJson} from '../model/AccountJson';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// https://stackoverflow.com/questions/19641783/google-drive-api-username-password-authentication#19643080
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount

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

  async getWebAuthUrl(oAuth2Client: OAuth2Client, redirect_uri: string, state: string): Promise<string> {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'online',
      scope: SCOPES,
      redirect_uri,
      state
    });

    return authUrl;
  }

  async getWebToken(oAuth2Client: OAuth2Client, redirect_uri: string, code: string): Promise<GoogleAuth> {
    const response = await oAuth2Client.getToken({
      code,
      redirect_uri
    });

    return {
      access_token: response.tokens.access_token,
      refresh_token: response.tokens.refresh_token,
      scope: response.tokens.scope,
      token_type: response.tokens.token_type,
      expiry_date: response.tokens.expiry_date,
      id_token: response.tokens.id_token
    };
  }

  async getCliAccessToken(oAuth2Client: OAuth2Client): Promise<GoogleAuth> {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });

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

    const credentials: GetTokenResponse = await oAuth2Client.getToken(code);

    return {
      access_token: credentials.tokens.access_token,
      refresh_token: credentials.tokens.refresh_token,
      scope: credentials.tokens.scope,
      token_type: credentials.tokens.token_type,
      expiry_date: credentials.tokens.expiry_date,
      id_token: credentials.tokens.id_token
    };
  }
}
