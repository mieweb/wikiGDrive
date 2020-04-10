'use strict';

import EventEmitter from 'events';

export class JobsQueue extends EventEmitter {

  constructor() {
    super();
    this.jobs = [];
  }

  pushOrReplaceJob(job) {
    const idx = this.jobs.findIndex(item => item.id === job.id);
    if (idx > -1) {
      this.jobs[idx] = job;
    } else {
      this.jobs.push(job);
    }

    this.emit('update', this);
  }

  popJob() {
    const job = this.jobs.shift();

    if (!job) {
      this.emit('empty');
    }

    return job;
  }

}
