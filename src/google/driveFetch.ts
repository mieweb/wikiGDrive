import {Readable} from 'stream';
import {SimpleFile} from '../model/GoogleFile';
import opentelemetry from '@opentelemetry/api';
import {QuotaLimiter} from './QuotaLimiter';
import {instrumentFunction} from '../telemetry';

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
  let isUnautorized = false;
  if (401 === response.status) {
    isUnautorized = true;
  }

  if (process.env.VERSION === 'dev' && !isUnautorized) {
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
    const fetchInstrumented = instrumentFunction(fetch, 1);
    const response = await fetchInstrumented(url, {
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
        const fetchInstrumented = instrumentFunction(fetch, 1);
        const response = await fetchInstrumented(url, {
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

const boundary = '-------314159265358979323846';

export async function driveFetchMultipart(quotaLimiter: QuotaLimiter, accessToken: string, method, requestUrl, params, formData: FormData): Promise<any> {
  params = filterParams(params);
  const url = requestUrl + '?' + new URLSearchParams(params).toString();

  let traceparent;
  if (process.env.ZIPKIN_URL) {
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      traceparent = span.spanContext().traceId;
    }
  }

  const after = `\n--${boundary}--`;
  function generateMultipart(image: ArrayBuffer, mimetype) {
    const source = new Uint8Array(image); // Wrap in view to get data

    const before = [
      `\n--${boundary}\n`,
      `Content-Type: ${mimetype}\n`,
      `Content-Length: ${source.byteLength}\n`,
      '\n'
    ].join('');

    const size = before.length + source.byteLength;
    const uint8array = new Uint8Array(size);

    for (let i = 0; i < before.length; i++) {
      uint8array[i] = before.charCodeAt(i) & 0xff;
    }
    for (let j= 0; j < source.byteLength; j++) {
      uint8array[j + before.length] = source[j];
    }

    return uint8array.buffer;
  }

  const arr: Blob[] = [];
  formData.forEach((entry) => {
    if (typeof entry !== 'string') {
      const blob: Blob = entry;
      arr.push(blob);
    }
  });

  const body: ArrayBuffer[] = [];
  for (const blob of arr) {
    const buff = generateMultipart(await blob.arrayBuffer(), blob.type);
    body.push(buff);
  }

  body.push(new TextEncoder().encode(after));

  if (!quotaLimiter) {
    const buff = await new Blob(body).arrayBuffer();
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(buff.byteLength),
        traceparent
      },
      body: buff
    });

    if (response.status >= 400) {
      throw await convertResponseToError(response);
    }

    let bodyResp = '';
    try {
      bodyResp = await response.text();
      return JSON.parse(bodyResp);
    } catch (err) {
      throw new Error('Invalid JSON: ' + url + ', ' + bodyResp);
    }
  }

  const response = await new Promise<Response>(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
    const job = async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-type': `multipart/related; boundary=${boundary}`,
            traceparent
          },
          body: await new Blob(body).arrayBuffer()
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

  let bodyResp = '';
  try {
    bodyResp = await response.text();
    return JSON.parse(bodyResp);
  } catch (err) {
    throw new Error('Invalid JSON: ' + url + ', ' + bodyResp);
  }
}
