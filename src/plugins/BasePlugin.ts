'use strict';

import {EventEmitter} from "events";

export class BasePlugin {
  protected eventBus: EventEmitter;

  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  async status() {
  }

  async flushData() {
  }
}
