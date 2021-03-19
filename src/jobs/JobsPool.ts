'use strict';

import {EventEmitter} from 'events';
import {JobsQueue} from './JobsQueue';

export class JobsPool extends EventEmitter {
  private size: number;
  private readonly capacity: number;
  private queue: any;

  constructor(capacity, queue: JobsQueue) {
    super();
    this.size = 0;
    this.capacity = capacity;
    this.queue = queue;

    queue.on('update', () => {
      // this.tryExecute();
    });

    setInterval(() => {
      this.tryExecute();
    }, 1000);
  }

  async tryExecute() {
    let jobsToTake = this.capacity - this.size;
    if (jobsToTake > this.queue.size()) {
      jobsToTake = this.queue.size();
    }

    const promises = [];

    for (let i = 0; i < jobsToTake; i++) {
      const job = this.queue.popJob();
      if (job) {
        promises.push(new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
          try {
            await job.execute();
            resolve();
          } catch (err) {
            this.emit('error', err);
            reject(err);
          }
        }));
      }
    }

    this.size += promises.length;
    await Promise.all(promises);
    this.size -= promises.length;

/*
    if (this.size < this.capacity) {
    }
*/
  }

  start() {
    this.tryExecute();
  }

}
