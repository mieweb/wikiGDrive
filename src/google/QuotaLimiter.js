'use strict';

export class QuotaLimiter {

  constructor(queries, seconds, initialJobs) {
    this.queries = queries;
    this.seconds = seconds;
    this.jobs = [].concat((initialJobs || []));
    setInterval(() => {
      this.handleQueue();
      if (this.saveHandler) {
        this.saveHandler(this.jobs.filter(job => !!job.ts));
      }
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
      const notStartedJob = this.jobs.find(job => !job.ts && job.func);
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

  setSaveHandler(handler) {
    this.saveHandler = handler;
  }
}
