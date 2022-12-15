'use strict';

import readline from 'readline';
import open from 'open';
import {promisify} from 'util';

import crypto from 'crypto';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
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

export interface TokenInfo {
  expiry_date: number;
  scopes: string[]
  access_type: string;
  azp: string;
  aud: string;
  exp: string;
}

export async function getTokenInfo(accessToken: string): Promise<TokenInfo> {
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + accessToken
    }
  });
  const json = await response.json();

  return {
    expiry_date: new Date().getTime() + json.expires_in * 1000,
    scopes: json.scope.split(' '),
    access_type: json.access_type,
    azp: json.azp,
    aud: json.aud,
    exp: json.exp
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
