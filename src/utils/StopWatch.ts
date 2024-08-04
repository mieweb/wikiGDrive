export class StopWatch {
  private start: number;
  private end: number;

  constructor() {
    this.start = Date.now();
  }

  stop() {
    this.end = Date.now();
  }

  toString(limitMs = 500) {
    if (!this.end) {
      this.stop();
    }
    const delta = this.end - this.start;
    if (delta > limitMs) {
      if (delta > 1000) {
        return `${Math.round(delta / 100) / 10}s`;
      }
      return `${delta}ms`;
    }

    return '';
  }

}
