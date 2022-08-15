import {queue, QueueObject} from 'async';
import winston from 'winston';
import {QueueTask, QueueTaskError} from './QueueTask';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const CONCURRENCY = 4;

export class QueueDownloader {
  private q: QueueObject<QueueTask>;
  private logger: winston.Logger;
  private progressCallback: ({total, completed}: { total: number; completed: number }) => void;

  private progress = {
    completed: 0,
    total: 0
  };

  constructor(logger: winston.Logger) {
    this.logger = logger.child({ filename: __filename });
    this.q = queue<QueueTask, QueueTaskError>(async (queueTask) => this.processQueueTask(queueTask), CONCURRENCY);

    this.q.error((err: QueueTaskError, queueTask) => {
      this.logger.error(err.message);

      if (403 === err.code) {
        // this.progress.failed++;
        // this.eventBus.emit('sync:progress', this.progress);
        this.progress.completed++;
        this.notify();
        return;
      }

      if (queueTask.retries > 0) {
        queueTask.retries--;
        this.q.push(queueTask);
      } else {
        // this.progress.failed++;
        // this.eventBus.emit('sync:progress', this.progress);
        this.progress.completed++;
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async finished() {
    return this.q.drain();
  }

  addTask(taskFetchDir: QueueTask) {
    this.q.push(taskFetchDir);
    this.progress.total++;
    this.notify();
  }

  onProgressNotify(progressCallback: ({total, completed}: { total: number; completed: number }) => void) {
    this.progressCallback = progressCallback;
  }

  notify() {
    if (this.progressCallback) {
      this.progressCallback({ completed: this.progress.completed, total: this.progress.total });
    }
  }
}
