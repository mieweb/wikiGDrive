import { parentPort } from 'worker_threads';

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
    console.error(err);
    parentPort.postMessage({ err });
  }
});
