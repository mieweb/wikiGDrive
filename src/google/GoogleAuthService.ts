import crypto from 'node:crypto';
import {Buffer} from 'node:buffer';

// https://stackoverflow.com/questions/19641783/google-drive-api-username-password-authentication#19643080
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount
const IV = '5383165476e1c2e3';
export function encrypt(val: string, key: string) {
  key = Buffer.from(key).toString('hex').substring(0, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, IV);
  const encrypted = cipher.update(val, 'utf8', 'hex');
  const final = encrypted + cipher.final('hex');
  const buffer = Buffer.from(final, 'hex');
  return buffer.toString('base64');
}

export function decrypt(encrypted: string, key: string) {
  if (!encrypted) {
    return null;
  }
  key = Buffer.from(key).toString('hex').substring(0, 32);
  const buffer = Buffer.from(encrypted, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, IV);
  const decrypted = decipher.update(buffer.toString('hex'), 'hex', 'utf8');
  const f = decrypted + decipher.final('utf8');
  return f;
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
    expiry_date: new Date().getTime() + (json.expires_in - 60) * 1000,
    scopes: json.scope ? json.scope.split(' ') : [],
    access_type: json.access_type,
    azp: json.azp,
    aud: json.aud,
    exp: json.exp
  };
}
