import {BasePlugin} from '../plugins/BasePlugin';
import {DefaultRenderer} from 'listr2/dist/renderer/default.renderer';
import chalk from 'chalk';
import {DriveConfig} from '../plugins/StoragePlugin';

class ProgressTask {
  public title: string;
  public subtasks: ProgressTask[];
  public message: {
    /** Run time of the task, if it has been successfully resolved. */
    duration?: number;
    /** Error message of the task, if it has been failed. */
    error?: string;
    /** Skip message of the task, if it has been skipped. */
    skip?: string;
    /** Rollback message of the task, if the rollback finishes */
    rollback?: string;
  };
  public failed = false;
  public pending = true;
  public completed = false;
  public enabled = true;
  public rolledBack = false;
  public options = {};

  constructor(private opts) {
    this.subtasks = [];
    this.message = {};
    for (const k in opts) {
      this[k] = opts[k];
    }
  }

  isEnabled() {
    return !!this.enabled;
  }

  isRetrying() {
    return false;
  }

  hasTitle() {
    return !!this.title;
  }

  hasFailed() {
    return !!this.failed;
  }

  hasRolledBack() {
    return !!this.rolledBack;
  }

  isRollingBack() {
    return false;
  }

  isPending() {
    return !!this.pending;
  }

  isCompleted() {
    return !!this.completed;
  }

  isSkipped() {
    return !!this.message.skip;
  }

  hasSubtasks() {
    return this.subtasks.length > 0;
  }
}

class RenderHook {
  private callback: () => void;

  subscribe(callback) {
    this.callback = callback;
  }

  fire() {
    if (!this.callback) {
      return;
    }
    this.callback();
  }
}

interface ParentsMap {
  [k: string]: string;
}

export class ProgressPlugin extends BasePlugin {
  private readonly tasks: ProgressTask[];
  private readonly renderHook: RenderHook;
  private mainResolve: (value?: (PromiseLike<void> | void)) => void;
  private renderer: DefaultRenderer;
  private parentsMap: ParentsMap = {};

  constructor(eventBus, logger) {
    super(eventBus, logger.child({ filename: __filename }));

    this.tasks = [];
/*
    this.tasks.push(new ProgressTask({
      title: 'test'
    }));

    this.tasks[0].subtasks.push(new ProgressTask({
      title: 'subtask'
    }))

    setTimeout(() => {
      this.tasks[0].subtasks.push(new ProgressTask({
        title: 'subtask2'
      }));
    }, 2000);

    setTimeout(() => {
      this.tasks[0].subtasks[0].message.skip = 'Skipped';
      // this.tasks[0].subtasks.splice(0, 1);
    }, 4000);
*/

    this.renderHook = new RenderHook();
    this.renderer = new DefaultRenderer(
      <any>this.tasks, // eslint-disable-line @typescript-eslint/no-explicit-any
      {
        suffixSkips: false
      },
      <any>this.renderHook // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    this.renderer.render();

    eventBus.on('progress:pause', () => {
      this.renderer.end();
    });
    eventBus.on('progress:unpause', () => {
      this.renderer.render();
    });

    eventBus.once('server:initialized', async () => {
      this.tasks.push(new ProgressTask({
        title: 'Server initialized',
        pending: false,
        completed: true
      }));
    });

    eventBus.once('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.tasks.push(new ProgressTask({
        title: 'Wikigdrive initialized: ' + chalk.green(drive_config.drive),
        pending: false,
        completed: true
      }));

      eventBus.once('main:done', async () => {
        this.mainResolve();
      });
    });

    eventBus.on('quota:limit', async (limit) => {
      if (!this['QuotaTask']) {
        this['QuotaTask'] = new ProgressTask({
          title: 'Quota'
        });
        this.tasks.push(this['QuotaTask']);
      }
      this['QuotaTask'].title = 'Quota: ' + limit.queries + ' queries / ' + limit.seconds + ' seconds';
    });

    eventBus.on('watch:event', async (changesCount) => {
      if (!this['WatchTask']) {
        this['WatchTask'] = new ProgressTask({
          title: 'Watching'
        });
        this.tasks.push(this['WatchTask']);
      }
      if (changesCount > 0) {
        this['WatchTask'].lastTime = +new Date();
        this['WatchTask'].changesCount = changesCount;
      }

      setTimeout(() => {
        if (this['WatchTask'].changesCount > 0) {
          const ago = Math.round((+new Date() - this['WatchTask'].lastTime) / 1000);
          this['WatchTask'].title = 'Watching, last change: ' + this['WatchTask'].changesCount + ' files, ' + ago + ' seconds ago';
        }
      }, 1000);
    });

    this.addPluginProgressTask('sync', 'Listening');
    this.addPluginProgressTask('download', 'Downloading');
    this.addPluginProgressTask('external', 'Downloading external');
    this.addPluginProgressTask('transform', 'Transforming');
    this.addPluginProgressTask('server', 'Server');
  }

  private addPluginProgressTask(prefix: string, title: string) {
    const taskKey = prefix + 'PluginTask';

    this.eventBus.on(prefix + ':progress', async (context) => {
      let tasks = this.tasks;

      if (prefix.indexOf(':') > -1) {
        const parts = prefix.split(':');
        parts.splice(parts.length - 1, 1);
        for (let i = 0; i < parts.length; i++) {
          const parentPrefix = parts.slice(0, i + 1).join(':');
          if (this.parentsMap[parentPrefix]) {
            if (!this[parentPrefix]) {
              this[parentPrefix] = new ProgressTask({
                title: this.parentsMap[parentPrefix]
              });

              tasks.push(this[parentPrefix]);
            }
            tasks = this[parentPrefix].subtasks;
          }
        }
      }

      if (!this[taskKey]) {
        this[taskKey] = new ProgressTask({
          title: title
        });
        tasks.push(this[taskKey]);
      }

      if (context.failed > 0) {
        this[taskKey].title = title + ' ' + context.completed + '/' + chalk.red(context.failed) + '/' + context.total;
      } else {
        this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
      }
    });

    this.eventBus.on(prefix + ':done', async (context) => {
      if (!this[taskKey]) {
        return;
      }

      if (context.failed > 0) {
        this[taskKey].title = title + ' ' + context.completed + '/' + chalk.red(context.failed) + '/' + context.total;
      } else {
        this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
      }
      this[taskKey].pending = false;
      this[taskKey].failed = false;
      this[taskKey].completed = true;
    });

    this.eventBus.on(prefix + ':failed', async (context) => {
      if (!this[taskKey]) {
        return;
      }

      if (context.failed > 0) {
        this[taskKey].title = title + ' ' + context.completed + '/' + chalk.red(context.failed) + '/' + context.total;
      } else {
        this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
      }
      this[taskKey].pending = false;
      this[taskKey].failed = true;
      this[taskKey].completed = true;
    });
  }
}
