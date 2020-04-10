/* eslint-disable no-async-promise-executor */
'use strict';

import {google} from 'googleapis';
import readline from 'readline';
import fs from 'fs';

import {JWT} from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// https://stackoverflow.com/questions/19641783/google-drive-api-username-password-authentication#19643080
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount

export class GoogleAuthService {

  constructor(configService) {
    this.configService = configService;
  }

  async authorizeServiceAccount(account_json_file_name) {
    const opts = JSON.parse(fs.readFileSync(account_json_file_name));

    return new JWT(opts.client_email, null, opts.private_key, SCOPES);
  }

  async authorize(client_id, client_secret) {
    if (!client_id) throw 'Unknown: client_id';
    if (!client_secret) throw 'Unknown: client_secret';

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');

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

    const google_auth = await this.configService.loadGoogleAuth();

    if (google_auth) {
      oAuth2Client.setCredentials(google_auth);
      return oAuth2Client;
    } else {
      return this.getAccessToken(oAuth2Client);
    }
  }

  getAccessToken(oAuth2Client) {
    return new Promise((resolve) => {

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
      });
      console.log('Authorize this app by visiting this url:', authUrl);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, async (err, credentials) => {
          if (err) return console.error('Error retrieving access token', err);
          oAuth2Client.setCredentials(credentials);
          // Store the token to disk for later program executions

          await this.configService.saveGoogleAuth(credentials);

          resolve(oAuth2Client);
        });
      });
    });
  }
}
