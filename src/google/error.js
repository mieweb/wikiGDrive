import {Readable} from 'stream';

async function handleReadable(obj) {
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

export async function handleGoogleError(err, reject) {
  if (parseInt(err.code) === 403) { // Retry

    if (err.message) {
      const errorMessage = await handleReadable(err.message);
      console.log('errorMessage', errorMessage);
      if (errorMessage && errorMessage.indexOf('User Rate Limit Exceeded') > -1) {
        reject(err); // TODO rate error
        return;
      }
      if (errorMessage.error && errorMessage.error.message && errorMessage.error.message.indexOf('User Rate Limit Exceeded') > -1) {
        reject(err); // TODO rate error
        return;
      }
    }

    if (err.config && err.config.url) {
      console.error('Forbidden', err.config.url);
    }
    if (err.response && err.response.data) {
      const errorData = await handleReadable(err.response.data);
        // console.log(errorData);
      reject(new Error(errorData));
      return;
    }
  }

  // console.error(err);
  reject(err);
}
