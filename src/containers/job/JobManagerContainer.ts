import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import {FileId} from '../../model/model';
import {GoogleFolderContainer} from '../google_folder/GoogleFolderContainer';
import {TransformContainer} from '../transform/TransformContainer';

import {fileURLToPath} from 'url';
import {PreviewRendererContainer} from '../preview/PreviewRendererContainer';
import {WatchChangesContainer} from '../changes/WatchChangesContainer';
import {GoogleFile} from '../../model/GoogleFile';
import {UserConfigService} from '../google_folder/UserConfigService';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor';
import {WorkerPool} from './WorkerPool';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);

export type JobType = 'sync' | 'sync_all' | 'transform' | 'render_preview';
export type JobState = 'waiting' | 'running' | 'failed' | 'done';

export interface Job {
  progress?: { total: number; completed: number };
  type: JobType;
  state?: JobState;
  title: string;
  payload?: string;
  ts?: number; // scheduled at
  started?: number; // started at
  finished?: number; // finished at
  startAfter?: number;
}

export interface Toast {
  title: string;
  message: string;
}

export interface DriveJobs {
  driveId: FileId;
  jobs: Job[];
}

export interface DriveJobsMap {
  [driveId: FileId]: DriveJobs;
}

function notCompletedJob(job: Job) {
  return ['waiting', 'running'].includes(job.state);
}

function removeOldRenderPreview() {
  return (job: Job) => {
    if (job.type !== 'render_preview') {
      return true;
    }
    return !(job.state === 'failed' || job.state === 'done');
  };
}

function removeOldTransformJobs() {
  return (job: Job) => {
    if (job.type !== 'transform') {
      return true;
    }
    return !(job.state === 'failed' || job.state === 'done');
  };
}

function removeOldFullSyncJobs() {
  return (job: Job) => {
    if (job.type !== 'sync_all') {
      return true;
    }
    return !(job.state === 'failed' || job.state === 'done');
  };
}

function removeOldSingleJobs(fileId) {
  if (fileId) {
    return (job: Job) => {
      if (job.type !== 'sync') {
        return true;
      }
      if (job.payload !== fileId) {
        return true;
      }
      return !(job.state === 'failed' || job.state === 'done');
    };
  }

  return (job: Job) => {
    if (job.type !== 'sync') {
      return true;
    }
    return !(job.state === 'failed' || job.state === 'done');
  };
}

export class JobManagerContainer extends Container {
  private driveJobsMap: DriveJobsMap = {};
  private workerPool: WorkerPool;

  constructor(public readonly params: ContainerConfig) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.workerPool = new WorkerPool(os.cpus().length);
  }

  async getDriveJobs(driveId): Promise<DriveJobs> {
    if (!this.driveJobsMap[driveId]) {
      const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
      const driveJobs = await driveFileSystem.readJson('.jobs.json');
      this.driveJobsMap[driveId] = driveJobs || {
        driveId, jobs: []
      };
    }
    return this.driveJobsMap[driveId];
  }

  async setDriveJobs(driveId, driveJobs) {
    if (driveJobs) {
      this.driveJobsMap[driveId] = driveJobs;
    }
    this.engine.emit(driveId, 'jobs:changed', driveJobs);
    const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
    await driveFileSystem.writeJson('.jobs.json', driveJobs);
  }

  async scheduleWorker(type: string, payload: any): Promise<any> {
    return this.workerPool.schedule(type, payload)
      .catch(err => this.engine.logger.error('Worker error', err));
  }

  async schedule(driveId: FileId, job: Job) {
    job.state = 'waiting';
    job.ts = +new Date();

    const driveJobs = await this.getDriveJobs(driveId);

    switch (job.type) {
      case 'sync':
        if (driveJobs.jobs.find(subJob => subJob.type === 'sync_all' && notCompletedJob(subJob))) {
          return;
        }
        if (driveJobs.jobs.find(subJob => subJob.type === 'sync' && subJob.payload === job.payload && notCompletedJob(job))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'sync_all':
        if (driveJobs.jobs.find(subJob => subJob.type === 'sync_all' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs = driveJobs.jobs.filter(subJob => subJob.state === 'running');
        driveJobs.jobs.push(job);
        break;
      case 'render_preview':
        if (driveJobs.jobs.find(subJob => subJob.type === 'render_preview' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'transform':
        if (driveJobs.jobs.find(subJob => subJob.type === 'transform' && notCompletedJob(subJob))) {
          return;
        }
        this.engine.emit(driveId, 'toasts:added', {
          title: 'Transform scheduled',
          message: JSON.stringify(job, null, 2),
          type: 'transform:scheduled',
          payload: job.payload ? job.payload : 'all'
        });
        driveJobs.jobs.push(job);
        break;
    }

    await this.setDriveJobs(driveId, driveJobs);
  }

  async ps(): Promise<DriveJobsMap> {
    return this.driveJobsMap;
  }

  async inspect(driveId: FileId): Promise<DriveJobs> {
    return await this.getDriveJobs(driveId);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {
    setInterval(async () => {
      try {
        const now = +new Date();
        for (const driveId in this.driveJobsMap) {
          const driveJobs = await this.getDriveJobs(driveId);
          if (driveJobs.jobs.length === 0) {
            delete this.driveJobsMap[driveId];
            await this.setDriveJobs(driveId, this.driveJobsMap[driveId]);
            continue;
          }

          const lastTs = driveJobs.jobs[driveJobs.jobs.length - 1].ts;
          if (now - lastTs < 1000) {
            continue;
          }

          if (driveJobs.jobs.find(job => job.state === 'running')) {
            continue;
          }

          const currentJob = driveJobs.jobs.find(job => job.state === 'waiting' && (!job.startAfter || job.startAfter > now));
          if (!currentJob) {
            continue;
          }

          currentJob.state = 'running';
          currentJob.started = now;
          this.engine.emit(driveId, 'jobs:changed', driveJobs);
          this.runJob(driveId, currentJob)
            .then(() => {
              if (currentJob.type === 'render_preview') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldRenderPreview());
              }
              if (currentJob.type === 'transform') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldTransformJobs());
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Transform done',
                  type: 'transform:done',
                  payload: currentJob.payload || 'all'
                });
              }
              if (currentJob.type === 'sync_all') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldFullSyncJobs());
                driveJobs.jobs = driveJobs.jobs.filter(removeOldSingleJobs(null));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync all done',
                  type: 'sync:done',
                  payload: 'all'
                });
              }
              if (currentJob.type === 'sync') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldSingleJobs(currentJob.payload));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync done',
                  type: 'sync:done',
                  payload: currentJob.payload
                });
              }
              currentJob.state = 'done';
              currentJob.finished = +new Date();
              this.setDriveJobs(driveId, driveJobs);
            })
            .catch(err => {
              const logger = this.engine.logger.child({ filename: __filename, driveId: driveId });
              logger.error(err);
              if (currentJob.type === 'render_preview') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldRenderPreview());
              }
              if (currentJob.type === 'transform') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldTransformJobs());
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Transform failed',
                  type: 'transform:failed',
                  payload: currentJob.payload || 'all'
                });
              }
              if (currentJob.type === 'sync_all') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldFullSyncJobs());
                driveJobs.jobs = driveJobs.jobs.filter(removeOldSingleJobs(null));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync all failed',
                  type: 'sync:failed',
                  payload: 'all'
                });
              }
              if (currentJob.type === 'sync') {
                driveJobs.jobs = driveJobs.jobs.filter(removeOldSingleJobs(currentJob.payload));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync failed',
                  type: 'sync:failed',
                  payload: currentJob.payload
                });
              }
              currentJob.state = 'failed';
              currentJob.finished = +new Date();
              this.setDriveJobs(driveId, driveJobs);
            });
        }
      } catch (err) {
        this.engine.logger.error(err.message);
      }
    }, 100);
  }

  private async transform(folderId: FileId, filesIds: FileId[] = []) {
    const watchChangesContainer = <WatchChangesContainer>this.engine.getContainer('watch_changes');
    const changesToFetch: GoogleFile[] = await watchChangesContainer.getChanges(folderId);
    const transformContainer = new TransformContainer({
      name: folderId
    }, { filesIds });
    const generatedFileService = await this.filesService.getSubFileService(folderId + '_transform', '/');
    const googleFileSystem = await this.filesService.getSubFileService(folderId, '/');
    await transformContainer.mount2(
      googleFileSystem,
      generatedFileService
    );

    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    transformContainer.setTransformSubDir(userConfigService.config.transform_subdir);
    transformContainer.onProgressNotify(({ completed, total }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'transform');
      if (job) {
        job.progress = {
          completed: completed,
          total: total
        };
        this.engine.emit(folderId, 'jobs:changed', this.driveJobsMap[folderId]);
      }
    });
    await this.engine.registerContainer(transformContainer);
    try {
      await transformContainer.run(folderId);

      const markdownTreeProcessor = new MarkdownTreeProcessor(generatedFileService);
      await markdownTreeProcessor.load();

      if (filesIds.length > 0) {
        await this.scheduleRetry(folderId, changesToFetch.filter(file => filesIds.includes(file.id)), markdownTreeProcessor);
      } else {
        await this.scheduleRetry(folderId, changesToFetch, markdownTreeProcessor);
      }
    } finally {
      await this.engine.unregisterContainer(transformContainer.params.name);
    }
  }

  private async sync(folderId: FileId, filesIds: FileId[] = []) {
    const downloadContainer = new GoogleFolderContainer({
      cmd: 'pull',
      name: folderId,
      folderId: folderId,
      apiContainer: 'google_api'
    }, { filesIds });
    await downloadContainer.mount(await this.filesService.getSubFileService(folderId, '/'));
    downloadContainer.onProgressNotify(({ completed, total }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'sync_all');
      if (job) {
        job.progress = {
          completed: completed,
          total: total
        };
        this.engine.emit(folderId, 'jobs:changed', this.driveJobsMap[folderId]);
      }
    });
    await this.engine.registerContainer(downloadContainer);
    try {
      await downloadContainer.run();
    } finally {
      await this.engine.unregisterContainer(downloadContainer.params.name);
    }
  }

  private async renderPreview(folderId: FileId) {
    const previewRendererContainer = new PreviewRendererContainer({
      name: folderId
    });
    await previewRendererContainer.mount(await this.filesService.getSubFileService(folderId, '/'));
    await this.engine.registerContainer(previewRendererContainer);
    try {
      await previewRendererContainer.run(folderId);
    } finally {
      await this.engine.unregisterContainer(previewRendererContainer.params.name);
    }
  }

  private async scheduleRetry(driveId: FileId, changesToFetch, markdownTreeProcessor: MarkdownTreeProcessor) {
    if (changesToFetch.length === 0) {
      return;
    }
    if (markdownTreeProcessor.isEmpty()) {
      return;
    }

    const filesToRetry = [];
    for (const change of changesToFetch) {
      const [treeItem] = await markdownTreeProcessor.findById(change.id);
      if (treeItem.modifiedTime && treeItem.modifiedTime < change.modifiedTime) {
        filesToRetry.push(change);
      }
    }

    const now = +new Date();
    if (filesToRetry.length > 0) {
      for (const change of filesToRetry) {
        await this.schedule(driveId, {
          type: 'sync',
          startAfter: now + 10 * 1000,
          payload: change.id,
          title: 'Retry syncing file: ' + change.title
        });
      }
    }
  }

  private async runJob(driveId: FileId, job: Job) {
    const logger = this.engine.logger.child({ filename: __filename, driveId: driveId });
    logger.info('runJob ' + driveId + ' ' + JSON.stringify(job));
    try {
      switch (job.type) {
        case 'sync':
          await this.sync(driveId, [ job.payload ]);
          break;
        case 'sync_all':
          await this.sync(driveId);
          break;
        case 'transform':
          await this.transform(driveId, job.payload ? [ job.payload ] : [] );
          break;
        case 'render_preview':
          await this.renderPreview(driveId);
          break;
      }
    } catch (err) {
      logger.error(err.message);
      console.error('Job failed', err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

}
