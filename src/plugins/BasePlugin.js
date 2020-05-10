'use strict';

export class BasePlugin {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  finished() {
    return this.promise;
  }
}
