import fetch, {Response} from 'node-fetch';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';

import {Readable} from 'stream';
import {SimpleFile} from '../model/GoogleFile';
import {HasQuotaLimiter} from './AuthClient';

async function handleReadable(obj): Promise<string> {
  if (obj instanceof Readable) {
    const chunks = [];
    for await (const chunk of obj) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  } else {
    return obj;
  }
}

interface GoogleDriveServiceErrorParams {
  isQuotaError: boolean;

  status?: number;
  file?: SimpleFile;
  folderId?: string;
}

export class GoogleDriveServiceError extends Error {
  public status: number;
  private file: SimpleFile;
  private folderId: string;
  private isQuotaError: boolean;

  constructor(msg, params?: GoogleDriveServiceErrorParams) {
    super(msg);
    if (params) {
      this.status = params.status;
      this.isQuotaError = params.isQuotaError;

      this.file = params.file;
      this.folderId = params.folderId;
    }
  }
}

interface DriveError {
  error?: {
    errors: Array<{
      message: string;
    }>;
    message?: string;
  }
}

function jsonToErrorMessage(json): string {
  try {
    json = JSON.parse(json);
  } catch (err) {
    return json;
  }

  if (typeof json === 'string') {
    return json;
  }
  if (json.error) {
    const driveError: DriveError = json;

    if (driveError.error.errors && Array.isArray(driveError.error.errors)) {
      return driveError.error.errors
        .map(error => {
          if (error.message) {
            return error.message;
          }
          return JSON.stringify(error);
        })
        .join('\n');
    }

    if (driveError.error.message && typeof driveError.error.message === 'string') {
      return driveError.error.message;
    }

    if ('string' === typeof driveError.error) {
      return driveError.error;
    }
  }
}

export async function handleGoogleError(err, reject, clientType: string) {
  if (err.message) {
    err.message = await handleReadable(err.message);
  }

  if (err.response && err.response.data) {
    err.response.data = await handleReadable(err.response.data);
  }

  if (parseInt(err.code) === 429) { // Too many requests
    err.isQuotaError = true;
    reject(err);
    return;
  }
  if (parseInt(err.code) === 403) { // Retry
    if (err.isQuotaError) { // Already decoded
      reject(err);
      return;
    }

    if (err.message) {
      const json = err.message;
      const errorMessage = jsonToErrorMessage(json);
      if (errorMessage && errorMessage.indexOf('User Rate Limit Exceeded') > -1) {
        err.isQuotaError = true;
        reject(err);
        return;
      }

      if ('string' === typeof errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
    }

    if (err.response && err.response.data) {
      const errorData = err.response.data;
      if ('string' === typeof errorData) {
        reject(new Error(errorData));
        return;
      }
    }

    if (err.config && err.config.url) {
      throw err;
    }
  }

  reject(err);
}

export function filterParams(params) {
  const retVal = {};

  for (const key of Object.keys(params)) {
    const value = params[key];
    if ('undefined' === typeof value) {
      continue;
    }
    retVal[key] = value;
  }

  return retVal;
}

export async function convertResponseToError(response) {
  const body = await response.text();
  const message = jsonToErrorMessage(body) || response.statusText;

  let isQuotaError = false;
  if (429 === response.status) {
    isQuotaError = true;
  }
  if (message.indexOf('User Rate Limit Exceeded') > -1) {
    isQuotaError = true;
  }

  return new GoogleDriveServiceError(message, {
    status: response.status,
    isQuotaError
    // file,
    // folderId
  });
}

async function driveRequest(auth: OAuth2Client & HasQuotaLimiter, method, requestUrl, params) {
  params = filterParams(params);
  const url = requestUrl + '?' + new URLSearchParams(params).toString();

  const accessToken = await auth.getAccessToken();

  const quotaLimiter = auth.getQuotaLimiter();
  if (!quotaLimiter) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + accessToken.token.trim()
      }
    });

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    return response;
  }

  const response = await new Promise<Response>(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
    const job = async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: 'Bearer ' + accessToken.token.trim()
          }
        });

        if (response.status >= 400) {
          return reject(await convertResponseToError(response));
        }

        resolve(response);
      } catch (err) {
        reject(err);
      }

    };

    if (requestUrl.endsWith('drive/v3/files')) {
      job.skipCounter = true;
    }

    quotaLimiter.addJob(job);
  });

  return response;
}

export async function driveFetch(auth: OAuth2Client & HasQuotaLimiter, method, url, params) {
  const response = await driveRequest(auth, method, url, params);
  try {
    const body = await response.text();
    return JSON.parse(body);
  } catch (err) {
    throw Error('Invalid JSON');
  }
}

export async function driveFetchStream(auth: OAuth2Client & HasQuotaLimiter, method, url, params): Promise<NodeJS.ReadableStream> {
  const response = await driveRequest(auth, method, url, params);
  return response.body;
}
