import winston from 'winston';

export const INITIAL_RETRIES = 4;

export class QueueTaskError extends Error {
  code: number;
}

export class QueueTask {
  retries: number;

  constructor(protected logger: winston.Logger) {
    this.retries = INITIAL_RETRIES;
  }

  async run(): Promise<QueueTask[]> {
    return [];
  }

}
