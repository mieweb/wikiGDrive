import {Readable} from 'stream';
import {SimpleFile} from '../model/GoogleFile';
import opentelemetry from '@opentelemetry/api';
import {QuotaLimiter} from './QuotaLimiter';

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

  if (process.env.VERSION === 'dev') {
    console.trace();
    console.error('convertResponseToError response', response.status, response.statusText, response.headers);
    console.error('convertResponseToError body', body);
  }

  return new GoogleDriveServiceError(message, {
    status: response.status,
    isQuotaError
    // file,
    // folderId
  });
}

async function driveRequest(quotaLimiter: QuotaLimiter, accessToken: string, method, requestUrl, params, body?): Promise<Response> {
  params = filterParams(params);
  const url = requestUrl + '?' + new URLSearchParams(params).toString();

  let traceparent;
  if (process.env.ZIPKIN_URL) {
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      traceparent = span.spanContext().traceId;
    }
  }

  if (!quotaLimiter) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-type': body ? 'application/json' : undefined,
        traceparent
      },
      body: body ? JSON.stringify(body): undefined
    });

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    return response;
  }

  return await new Promise<Response>(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
    const job = async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-type': body ? 'application/json' : undefined,
            traceparent
          },
          body: body ? JSON.stringify(body): undefined
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

    if (process.env.ZIPKIN_URL) {
      job.parentCtx = opentelemetry.context.active();
    }

    quotaLimiter.addJob(job);
  });
}

export async function driveFetch(quotaLimiter: QuotaLimiter, accessToken: string, method, url, params, bodyReq?) {
  const response = await driveRequest(quotaLimiter, accessToken, method, url, params, bodyReq);
  let bodyResp = '';
  try {
    bodyResp = await response.text();
    return JSON.parse(bodyResp);
  } catch (err) {
    throw new Error('Invalid JSON: ' + url + ', ' + bodyResp);
  }
}

export async function driveFetchStream(quotaLimiter: QuotaLimiter, accessToken: string, method, url, params): Promise<ReadableStream<Uint8Array>> {
  const response = await driveRequest(quotaLimiter, accessToken, method, url, params);
  return response.body;
}
