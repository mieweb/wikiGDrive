import {EventEmitter} from 'node:events';

class Job<T> {
  private readonly starter: { (): Promise<T> };
  public readonly promise: Promise<T>;
  private resolve: (value?: T) => void;
  private reject: (reason?: Error) => void;

  constructor(starter) {
    this.starter = starter;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async execute() {
    try {
      const result: T = await this.starter();
      this.resolve(result);
    } catch (err) {
      this.reject(err);
    }
  }

}

export class JobsQueue extends EventEmitter {
  private jobs: Job<unknown>[];

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
