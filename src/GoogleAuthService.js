'use strict';

const {google} = require('googleapis');
const readline = require('readline');

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

  async authorize(client_id, client_secret) {
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

    return new Promise(async (resolve, reject) => {
      const config = await this.configService.loadConfig();
      if (config.access_token) {
        oAuth2Client.setCredentials(config.access_token);
        resolve(oAuth2Client);
      } else {
        resolve(this.getAccessToken(oAuth2Client));
      }
    });
  }

  getAccessToken(oAuth2Client) {
    return new Promise((resolve, reject) => {

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('Authorize this app by visiting this url:', authUrl);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, async (err, token) => {
          if (err) return console.error('Error retrieving access token', err);
          oAuth2Client.setCredentials(token);
          // Store the token to disk for later program executions

          const config = await this.configService.loadConfig();
          config.access_token = token;
          await this.configService.saveConfig(config);

          resolve(oAuth2Client);
        });
      });
    })

  }

}
