import {BasePlugin} from '../plugins/BasePlugin';
import {DefaultRenderer} from 'listr2/dist/renderer/default.renderer';

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
  private mainResolve: (value?: (PromiseLike<void> | void)) => void;
  private tasks: ProgressTask[];
  private renderer: DefaultRenderer;
  private renderHook: RenderHook;
  private listenTask: ProgressTask;
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

    eventBus.once('main:run', async () => {
      this.tasks.push(new ProgressTask({
        title: 'Wikigdrive initialized',
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

    this.parentsMap['transform'] = 'Transforming';

    this.addPluginProgressTask('listen', 'Listening');
    this.addPluginProgressTask('download', 'Downloading');
    this.addPluginProgressTask('external', 'Downloading external');
    this.addPluginProgressTask('transform:documents', 'Transforming documents');
    this.addPluginProgressTask('transform:diagrams', 'Transforming diagrams');
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

      this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
    });

    this.eventBus.on(prefix + ':done', async (context) => {
      if (!this[taskKey]) {
        return;
      }

      this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
      this[taskKey].pending = false;
      this[taskKey].failed = false;
      this[taskKey].completed = true;
    });

    this.eventBus.on(prefix + ':failed', async (context) => {
      if (!this[taskKey]) {
        return;
      }

      this[taskKey].title = title + ' ' + context.completed + '/' + context.total;
      this[taskKey].pending = false;
      this[taskKey].failed = true;
      this[taskKey].completed = true;
    });
  }
}
