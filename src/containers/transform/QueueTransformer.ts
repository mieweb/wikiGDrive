import {queue, QueueObject} from 'async';
import winston from 'winston';
import {QueueTask, QueueTaskError} from '../google_folder/QueueTask';
import {fileURLToPath} from 'url';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);

export const SINGLE_THREADED_TRANSFORM = false;
const CONCURRENCY = SINGLE_THREADED_TRANSFORM ? 4 : os.cpus().length;

export class QueueTransformer {
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
      this.logger.error(err);

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
      this.progress.completed++;
    }
    this.notify();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async finished() {
    if (this.q.length() === 0) {
      return;
    }
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
