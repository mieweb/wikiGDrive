'use strict';

export class QuotaLimiter {

  constructor(queries, seconds) {
    this.queries = queries;
    this.seconds = seconds;
    this.jobs = [];
    setInterval(() => {
      this.handleQueue();
    }, 500);
  }

  addJob(func) {
    this.jobs.push({
      done: false,
      func
    });
  }

  handleQueue() {
    const now = +new Date() / 1000;
    this.removeOlderThan(now - this.seconds);
    const jobsInLastPeriod = this.jobs.filter(job => !!job.ts).length;

    let jobsToAdd = this.queries - jobsInLastPeriod;
    while (jobsToAdd > 0) {
      const notStartedJob = this.jobs.find(job => !job.ts);
      if (!notStartedJob) {
        break;
      }

      jobsToAdd--;
      notStartedJob.ts = now;
      notStartedJob.func();
    }
  }

  removeOlderThan(minTime) {
    this.jobs = this.jobs.filter(job => !job.ts || job.ts >= minTime);
  }

}
