import {Worker} from 'node:worker_threads';

const __dirname = import.meta.dirname;

export interface BackLog {
  taskId: number;
  type: string;
  payload: any;
}

export class WorkerPool {
  private readonly workers: Map<number, Worker>;
  private readonly threadIdToTaskId: Map<number, number>;
  private readonly backlog: BackLog[] = [];
  private readonly promises: Map<number, [(data: any) => void, (data: any) => void]>;
  private taskIdCounter = 0;

  constructor(workersCount = 4) {
    this.workers = new Map(
      Array.from({ length: workersCount })
        .map<[number, Worker]>(() => {
          const w = new Worker(__dirname + '/worker.ts');
          return [w.threadId, w];
        })
    );

    // this.idle = Array.from(this.workers.keys());
    this.promises = new Map();
    this.threadIdToTaskId = new Map(
      Array.from(this.workers.keys())
        .map(threadId => [threadId, 0])
    );

    this.workers.forEach((worker, threadId) => {
      worker.on('error', err => {
        const taskId = this.threadIdToTaskId.get(threadId);
        this.threadIdToTaskId.set(worker.threadId, 0);
        this.runNext();

        const promise = this.promises.get(taskId);
        this.promises.delete(taskId);
        if (promise) {
          promise[1](err);
        }
      });
      worker.on('exit', err => {
        console.error('Worker exit', err);
      });
      worker.on('messageerror', err => {
        const taskId = this.threadIdToTaskId.get(threadId);
        this.threadIdToTaskId.set(worker.threadId, 0);
        this.runNext();

        const promise = this.promises.get(taskId);
        this.promises.delete(taskId);
        if (promise) {
          promise[1](err);
        }
      });
      worker.on('message', message => {
        const taskId = this.threadIdToTaskId.get(threadId);
        this.threadIdToTaskId.set(threadId, 0);
        this.runNext();

        const promise = this.promises.get(taskId);
        this.promises.delete(taskId);
        if (promise) {
          const {result, err} = message;
          if (err) {
            promise[1](err);
          } else {
            promise[0](result);
          }
        }
      });
    });
  }

  runNext() {
    if (this.backlog.length == 0) return;

    let threadId = 0;
    for (const key of this.threadIdToTaskId.keys()) {
      const value: number = this.threadIdToTaskId.get(key);
      if (value === 0) {
        threadId = key;
        break;
      }
    }

    if (threadId === 0) {
      return;
    }

    const task = this.backlog.shift();

    const msg = {...task};
    this.threadIdToTaskId.set(threadId, task.taskId);

    const worker = this.workers.get(threadId);
    worker.postMessage(msg);

    this.runNext();
  }

  schedule<k, j>(type: string, payload: k): Promise<j> {
    this.taskIdCounter++;
    this.backlog.push({ taskId: this.taskIdCounter, type, payload });

    const p = new Promise<j>((resolve, reject) => this.promises.set(this.taskIdCounter, [resolve, reject]));
    this.runNext();
    return p;
  }

}
