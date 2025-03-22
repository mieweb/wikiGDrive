import {queue, QueueObject} from 'async';
import winston from 'winston';
import {QueueTask, QueueTaskError} from './QueueTask.ts';

const __filename = import.meta.filename;

const CONCURRENCY = 4;

export class QueueDownloader {
  private q: QueueObject<QueueTask>;
  private logger: winston.Logger;
  private progressCallback: ({total, completed}: { total: number; completed: number; warnings: number; failed: number }) => void;

  private progress = {
    completed: 0,
    total: 0,
    warnings: 0,
    failed: 0
  };

  constructor(logger: winston.Logger) {
    this.logger = logger.child({ filename: __filename });
    this.q = queue<QueueTask, QueueTaskError>(async (queueTask) => this.processQueueTask(queueTask), CONCURRENCY);

    this.q.error((err: QueueTaskError, queueTask) => {
      this.logger.error(err.stack ? err.stack : err.message);

      if (403 === err.code) {
        this.progress.failed++;
        this.logger.error(err.stack ? err.stack : err.message);
        this.notify();
        return;
      }

      if (queueTask.retries > 0) {
        queueTask.retries--;
        this.q.push(queueTask);
      } else {
        this.logger.error(err.stack ? err.stack : err.message);
        this.progress.failed++;
        this.notify();
      }
    });
  }

  async processQueueTask(task: QueueTask) {
    const subTasks = await task.run();
    this.progress.completed++;
    this.notify();
    for (const subTask of subTasks) {
      this.q.push(subTask);
      this.progress.total++;
    }
    this.notify();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async finished() {
    return this.q.drain();
  }

  addTask(taskFetchDir: QueueTask) {
    this.q.push(taskFetchDir);
    this.progress.total++;
    this.notify();
  }

  onProgressNotify(progressCallback: ({total, completed, warnings, failed}: { total: number; completed: number; warnings: number; failed: number }) => void) {
    this.progressCallback = progressCallback;
  }

  notify() {
    if (this.progressCallback) {
      this.progressCallback({ completed: this.progress.completed, total: this.progress.total, warnings: this.progress.warnings, failed: this.progress.failed });
    }
  }
}
