'use strict';

import {EventEmitter} from 'events';
import {Logger} from 'winston';

export class BasePlugin {
  protected eventBus: EventEmitter;
  protected logger: Logger;

  constructor(eventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async status() {
  }

  async flushData() {
  }
}
