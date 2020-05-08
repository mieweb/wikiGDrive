import {Readable} from 'stream';

export async function handleGoogleError(err, reject) {
  if (parseInt(err.code) === 403) { // Retry

    if (err.message && err.message.indexOf('User Rate Limit Exceeded') > -1) {
      reject(err);
      return;
    }

    if (err.config && err.config.url) {
      console.error('Forbidden', err.config.url);
    }
    if (err.response && err.response.data) {
      if (err.response.data instanceof Readable) {
        const chunks = [];
        for await (const chunk of err.response.data) {
          chunks.push(chunk);
        }
        const errorData = Buffer.concat(chunks).toString();
        console.log(errorData);
        reject(new Error(errorData));
      } else {
        console.log(err.response.data);
        reject(new Error(err.response.data));
      }
      return;
    }
  }

  console.error(err);
  reject(err);
}
