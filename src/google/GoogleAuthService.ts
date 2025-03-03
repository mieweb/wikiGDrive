import * as base64 from './base64.ts';

// https://stackoverflow.com/questions/19641783/google-drive-api-username-password-authentication#19643080
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount

const IV: ArrayBuffer = new TextEncoder().encode('5383165476e1c2e3').slice(0, 16);

export async function encrypt(val: string, keyString: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(keyString).slice(0, 16), {   //this is the algorithm options
      name: 'AES-CBC',
    },
    false,
    ['encrypt', 'decrypt']
  );

  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-CBC',
    iv: IV, // @TODO: Don't re-use initialization vectors! Always generate a new iv every time your encrypt!
  }, key, new TextEncoder().encode(val));

  return base64.fromUint8Array(new Uint8Array(encrypted));
}

export async function decrypt(encrypted: string, keyString: string) {
  if (!encrypted) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyString).slice(0, 16), { //this is the algorithm options
      name: 'AES-CBC',
    },
    false,
    ['encrypt', 'decrypt']
  );

  const decrypted =  await crypto.subtle.decrypt({
    name: 'AES-CBC',
    iv: IV,
  }, key, base64.toUint8Array(encrypted));

  return new TextDecoder().decode(decrypted);
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
