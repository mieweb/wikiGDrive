import {Readable} from 'stream';

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

function jsonToErrorMessage(json) {

  try {
    json = JSON.parse(json);
  } catch (err) {
    return json;
  }

  if (typeof json === 'string') {
    return json;
  }
  if (json.error) {
    if (json.error.errors && Array.isArray(json.error.errors)) {
      return json.error.errors
        .map(error => {
          if (error.message) {
            return error.message;
          }
          return JSON.stringify(error);
        })
        .join('\n');
    }

    if (json.error.message && typeof json.error.message === 'string') {
      return json.error.message;
    }
  }
}

export async function handleGoogleError(err, reject, context) {
  if (err.dest) {
    delete err.dest;
  }

  if (err.message) {
    err.message = await handleReadable(err.message);
  }

  if (err.response && err.response.data) {
    err.response.data = await handleReadable(err.response.data);
  }

  if (parseInt(err.code) === 429) { // Too many requests
    err.isQuotaError = true;
    reject(err); // TODO rate error
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
        reject(err); // TODO rate error
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
      // console.error('Forbidden', err.config.url);
    }
  }

  // console.error(err);
  reject(err);
}
