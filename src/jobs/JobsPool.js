'use strict';

import EventEmitter from 'events';

export class JobsPool extends EventEmitter {

  JobsPool(capacity, queue) {
    this.size = 0;
    this.capacity = capacity;
    this.queue = queue;

    this.on('update', () => {
      this.tryExecute();
    });
  }

  async tryExecute() {
    if (this.size < this.capacity) {
      const job = this.queue.popJob();
      if (job) {
        this.size++;
        try {
          await job.handler();
        } catch (err) {
          this.emit('error', err);
        }
        this.size--;
        await this.tryExecute();
      }
    }
  }

  start() {
    this.tryExecute();
  }

}
