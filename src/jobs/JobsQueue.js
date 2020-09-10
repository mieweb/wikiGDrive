'use strict';

import EventEmitter from 'events';

class Job {

  constructor(starter) {
    this.starter = starter;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async execute() {
    try {
      const result = await this.starter();
      this.resolve(result);
    } catch (err) {
      this.reject(err);
    }
  }

}

export class JobsQueue extends EventEmitter {

  constructor() {
    super();
    this.jobs = [];
  }

  pushJob(starter) {
    const job = new Job(starter);
    this.jobs.push(job);
    this.emit('update', this);

    return job.promise;
  }

  popJob() {
    const job = this.jobs.shift();

    if (!job) {
      this.emit('empty');
    }

    return job;
  }

  size() {
    return this.jobs.length;
  }

}
