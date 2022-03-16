'use strict';

import EventEmitter from 'events';
import winston from 'winston';

const CONCURRENCY = 16;
const DELAY_AFTER_ERROR = 5;

export interface QuotaJob {
  ts?: number;
  done: boolean;
  func: () => Promise<void>;
  skipCounter?: boolean;
}

interface QuotaLimit {
  seconds: number;
  queries: number;
  ts: number;
}

export class QuotaLimiter {
  private jobs: QuotaJob[];
  private running = 0;
  private counter = 0;
  private initialLimit: QuotaLimit;
  private currentLimit: QuotaLimit;

  private oldCounter: number;
  private saveHandler: (jobs: QuotaJob[]) => void;
  private eventBus: EventEmitter;

  constructor(initialJobs: QuotaJob[] = [], private readonly logger: winston.Logger, eventBus?) {
    this.eventBus = eventBus;
    this.jobs = [].concat((initialJobs || []));
    setInterval(() => {
      this.handleQueue();
      if (this.saveHandler) {
        this.saveHandler(this.jobs.filter(job => !!job.ts));
      }
    }, 500);
  }

  setInitialLimit(queries, seconds) {
    this.initialLimit = { queries, seconds, ts: 0 };
    this.setLimit(queries, seconds);

    setInterval(() => {
      this.speedup();
    }, seconds * 1000);
  }

  slowdown() {
    const newLimits: QuotaLimit = {
      queries: Math.floor(this.currentLimit.queries / 2),
      seconds: this.currentLimit.seconds,
      ts: 0
    };
    if (this.setLimit(newLimits.queries, newLimits.seconds)) {
      this.logger.info('QuotaError, exponential slowdown: ' + newLimits.queries + ' queries per ' + newLimits.seconds + ' sec');
    }
  }

  speedup() {
    if (this.oldCounter === this.counter) {
      return;
    }
    if (this.jobs.length < 8) { // Don't speed up trivial queue
      return;
    }

    const newLimits: QuotaLimit = {
      queries: this.currentLimit.queries + 1,
      seconds: this.currentLimit.seconds,
      ts: 0
    };
    if (this.setLimit(newLimits.queries, newLimits.seconds)) {
      this.logger.info('Speedup: ' + newLimits.queries + ' queries per ' + newLimits.seconds + ' sec');
      this.oldCounter = this.counter;
    }
  }

  setLimit(queries, seconds) {
    if (seconds <= 0) return false;
    if (queries <= 0) return false;

    const now = +new Date() / 1000;

    if (this.currentLimit) {
      if (now - this.currentLimit.ts < seconds) { // Don't add limits more often than once 10s
        return false;
      }
      this.currentLimit = { queries, seconds, ts: now };
    } else {
      this.currentLimit = { queries, seconds, ts: 0 }; // Because of DELAY_AFTER_ERROR in handleQueue
    }

    if (this.eventBus) {
      this.eventBus.emit('quota:limit', this.currentLimit);
    }

    return true;
  }

  addJob(func) {
    this.jobs.push({
      done: false,
      func
    });
  }

  handleQueue() {
    if (this.running > CONCURRENCY) {
      return;
    }
    const now = +new Date() / 1000;
    const lastTs = this.currentLimit.ts;

    if (now - lastTs < DELAY_AFTER_ERROR) { // Limit added within last 10s
      return;
    }

    const maxLimiterSeconds = this.currentLimit ? this.currentLimit.seconds : 0;
    this.removeOlderThan(now - maxLimiterSeconds);

    let availableQuota = this.calculateAvailableQuota(now);


    while (availableQuota > 0) {
      const notStartedJob = this.jobs.find(job => !job.ts && job.func);
      if (!notStartedJob) {
        break;
      }

      availableQuota--;
      notStartedJob.ts = now;
      this.running++;
      process.nextTick(() => {
        if (!notStartedJob.skipCounter) {
          this.counter++;
        }

        notStartedJob.func()
          .then(() => {
            this.running--;
          })
          .catch(async (err) => {
            if (err.isQuotaError && this.currentLimit) {
              this.slowdown();
            }

            this.running--;
          });
      });
    }
  }

  removeOlderThan(minTime) {
    this.jobs = this.jobs.filter(job => !job.ts || job.ts >= minTime);
  }

  calculateAvailableQuota(now) {
    let availableQuota = CONCURRENCY;

    const limit = this.currentLimit;
    const quotaUsed = this.jobs.filter(job => !!job.ts && (now - job.ts) < limit.seconds).length;

    if (availableQuota > limit.queries - quotaUsed) {
      availableQuota = limit.queries - quotaUsed;
    }

    return availableQuota;
  }

  setSaveHandler(handler: (jobs: QuotaJob[]) => void) {
    this.saveHandler = handler;
  }
}
