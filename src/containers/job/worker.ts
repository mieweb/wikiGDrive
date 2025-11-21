import {parentPort} from 'node:worker_threads';
import fs from 'node:fs';
import {executeOdtToMarkdown} from '../../odt/executeOdtToMarkdown.ts';

parentPort.on('message', async (msg) => {
  try {
    const { type, payload } = msg;

    switch (type) {
      case 'OdtToMarkdown':
       parentPort.postMessage({ result: await executeOdtToMarkdown(payload) });
        return;
    }

    parentPort.postMessage({ err: new Error('Unhandled worker message: ' + type) });
  } catch (err) {
    console.error(err, msg.payload);
    parentPort.postMessage({ err });
    if (err.message.indexOf('Corrupted zip') > -1) {
      console.info('Corrupted zip, removing file: ', msg.payload.odtPath);
      fs.unlinkSync(msg.payload.odtPath);
    }
  }
});
