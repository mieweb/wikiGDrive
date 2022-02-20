import {ErrorCallback, queue, QueueObject} from 'async';
import * as winston from 'winston';
import {QueueTask, QueueTaskError} from './QueueTask';

const CONCURRENCY = 4;

export class QueueDownloader {
  private q: QueueObject<QueueTask>;

  constructor(private logger: winston.Logger) {
    this.q = queue<QueueTask, QueueTaskError>(async (queueTask, callback) => this.processQueueTask(queueTask, callback), CONCURRENCY);

    this.q.error((err: QueueTaskError, queueTask) => {
      this.logger.error(err);

      if (403 === err.code) {
        // this.progress.failed++;
        // this.eventBus.emit('sync:progress', this.progress);
        return;
      }

      if (queueTask.retries > 0) {
        queueTask.retries--;
        this.q.push(queueTask);
      } else {
        // this.progress.failed++;
        // this.eventBus.emit('sync:progress', this.progress);
      }
    });
  }

  async processQueueTask(task: QueueTask, callback: ErrorCallback<Error>) {
    try {
      const subTasks = await task.run();
      for (const subTask of subTasks) {
        this.q.push(subTask);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async finished() {
    return this.q.drain();
  }

  addTask(taskFetchDir: QueueTask) {
    this.q.push(taskFetchDir);
  }
}
