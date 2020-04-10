/* eslint-disable no-async-promise-executor */
'use strict';

import EventEmitter from 'events';

export class JobsPool extends EventEmitter {

  constructor(capacity, queue) {
    super();
    this.size = 0;
    this.capacity = capacity;
    this.queue = queue;

    queue.on('update', () => {
      // console.log('uuuuu');
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
        // console.log('aaaa', this.size, this.capacity, this.queue.size());
        // this.size++;

        promises.push(new Promise(async (resolve, reject) => {
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
