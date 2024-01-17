import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import {FileId} from '../../model/model';
import {GoogleFolderContainer} from '../google_folder/GoogleFolderContainer';
import {TransformContainer} from '../transform/TransformContainer';

import {fileURLToPath} from 'url';
import {UserConfigService} from '../google_folder/UserConfigService';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor';
import {WorkerPool} from './WorkerPool';
import os from 'os';
import {GitScanner} from '../../git/GitScanner';
import {FileContentService} from '../../utils/FileContentService';
import {CACHE_PATH} from '../server/routes/FolderController';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {ActionRunnerContainer} from '../action/ActionRunnerContainer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {getContentFileService} from '../transform/utils';
import {UploadContainer} from '../google_folder/UploadContainer';

const __filename = fileURLToPath(import.meta.url);

export type JobType = 'sync' | 'sync_all' | 'transform' | 'git_pull' | 'git_push' | 'git_reset' | 'git_commit' | 'run_action' | 'upload';
export type JobState = 'waiting' | 'running' | 'failed' | 'done';

export function initJob(): { id: string, state: JobState } {
  return {
    id: randomUUID(),
    state: 'waiting'
  };
}

export interface Job {
  id: string;
  state: JobState;
  progress?: { total: number; completed: number; warnings: number };
  type: JobType;
  title: string;
  trigger?: string;
  payload?: string;
  access_token?: string;
  ts?: number; // scheduled at
  started?: number; // started at
  finished?: number; // finished at
  startAfter?: number;
  user?: {
    name: string,
    email: string
  }
}

export interface Toast {
  title: string;
  message: string;
}

export interface DriveJobs {
  driveId: FileId;
  jobs: Job[];
  archive: Job[];
}

export interface DriveJobsMap {
  [driveId: FileId]: DriveJobs;
}

export async function clearCachedChanges(googleFileSystem: FileContentService) {
  await googleFileSystem.remove(CACHE_PATH);
}

function notCompletedJob(job: Job) {
  return ['waiting', 'running'].includes(job.state);
}

function removeOldByType(type: JobType) {
  return (job: Job) => {
    if (job.type !== type) {
      return true;
    }
    return !(job.state === 'failed' || job.state === 'done');
  };
}

function removeOldById(id) {
  return (job: Job) => {
    return job.id !== id;
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

function filterSplit(driveJobs: DriveJobs, filter) {
  driveJobs.archive = [].concat(driveJobs.archive).concat(driveJobs.jobs.filter(a => !filter(a)));
  driveJobs.archive = driveJobs.archive.slice(driveJobs.archive.length - 100, driveJobs.archive.length);
  driveJobs.jobs = driveJobs.jobs.filter(a => filter(a));
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
    if (!this.driveJobsMap[driveId].archive) {
      this.driveJobsMap[driveId].archive = [];
    }
    return this.driveJobsMap[driveId];
  }

  async setDriveJobs(driveId, driveJobs: DriveJobs) {
    if (driveJobs) {
      this.driveJobsMap[driveId] = driveJobs;
    }
    this.engine.emit(driveId, 'jobs:changed', driveJobs);
    const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
    await driveFileSystem.writeJson('.jobs.json', driveJobs);
  }

  async scheduleWorker(type: string, payload: unknown): Promise<unknown> {
    try {
      return await this.workerPool.schedule(type, payload);
    } catch(err) {
      this.engine.logger.error('Worker error ' + err);
      throw err;
    }
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
        if (driveJobs.jobs.find(subJob => subJob.type === 'sync' && subJob.payload === job.payload && notCompletedJob(subJob))) {
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
      case 'run_action':
        if (driveJobs.jobs.find(subJob => subJob.type === 'run_action' && notCompletedJob(subJob))) {
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
      case 'git_pull':
        if (driveJobs.jobs.find(subJob => subJob.type === 'git_pull' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'git_push':
        if (driveJobs.jobs.find(subJob => subJob.type === 'git_push' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'git_commit':
        if (driveJobs.jobs.find(subJob => subJob.type === 'git_commit' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'git_reset':
        if (driveJobs.jobs.find(subJob => subJob.type === 'git_reset' && notCompletedJob(subJob))) {
          return;
        }
        driveJobs.jobs.push(job);
        break;
      case 'upload':
        if (driveJobs.jobs.find(subJob => subJob.type === 'upload' && notCompletedJob(subJob))) {
          return;
        }
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
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    const folders = await folderRegistryContainer.getFolders();
    for (const driveId in folders) {
      const driveJobs = await this.getDriveJobs(driveId);
      if (driveJobs.jobs) {
        driveJobs.jobs = [];
        await this.setDriveJobs(driveId, {
          driveId, jobs: [], archive: driveJobs.archive
        });
      }
    }
    setInterval(async () => {
      try {
        const now = +new Date();
        for (const driveId in this.driveJobsMap) {
          const driveJobs = await this.getDriveJobs(driveId);
          if (driveJobs.jobs.length === 0 && driveJobs.archive.length === 0) {
            delete this.driveJobsMap[driveId];
            await this.setDriveJobs(driveId, this.driveJobsMap[driveId]);
          }

          if (driveJobs.jobs.length === 0) {
            delete this.driveJobsMap[driveId];
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

          this.runJob(driveId, currentJob, driveJobs)
            .then(async () => {
              filterSplit(driveJobs, removeOldById(currentJob.id));

              if (currentJob.type === 'upload') {
                filterSplit(driveJobs, removeOldByType('upload'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Google Drive upload done',
                  type: 'upload:done',
                  links: {}
                });
              }
              if (currentJob.type === 'git_reset') {
                filterSplit(driveJobs, removeOldByType('git_reset'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git reset done',
                  type: 'git_reset:done',
                  links: {
                    '#git_log': 'View git history'
                  },
                });
              }
              if (currentJob.type === 'git_commit') {
                filterSplit(driveJobs, removeOldByType('git_commit'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git commit done',
                  type: 'git_commit:done',
                  links: {
                    '#git_log': 'View git history'
                  },
                });
              }
              if (currentJob.type === 'git_push') {
                filterSplit(driveJobs, removeOldByType('git_push'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git push done',
                  type: 'git_push:done',
                  links: {
                    '#git_log': 'View git history'
                  },
                });
              }
              if (currentJob.type === 'sync_all') {
                filterSplit(driveJobs, removeOldByType('sync_all'));
                filterSplit(driveJobs, removeOldSingleJobs(null));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync all done',
                  type: 'sync:done',
                  payload: 'all'
                });
              }
              if (currentJob.type === 'sync') {
                filterSplit(driveJobs, removeOldSingleJobs(currentJob.payload));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync done',
                  type: 'sync:done',
                  payload: currentJob.payload
                });
              }
              currentJob.state = 'done';
              currentJob.finished = +new Date();
              await this.setDriveJobs(driveId, driveJobs);
            })
            .catch(err => {
              filterSplit(driveJobs, removeOldById(currentJob.id));

              if (currentJob.type === 'upload') {
                filterSplit(driveJobs, removeOldByType('upload'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Google Drive upload failed',
                  type: 'upload:failed',
                  err: err.message,
                  links: {
                    ['#drive_logs:job-' + currentJob.id]: 'View logs'
                  },
                });
              }
              if (currentJob.type === 'git_reset') {
                filterSplit(driveJobs, removeOldByType('git_reset'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git reset failed',
                  type: 'git_reset:failed',
                  err: err.message,
                  links: {
                    ['#drive_logs:job-' + currentJob.id]: 'View logs'
                  },
                });
              }
              if (currentJob.type === 'git_commit') {
                filterSplit(driveJobs, removeOldByType('git_commit'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git commit failed',
                  type: 'git_commit:failed',
                  err: err.message,
                  links: {
                    ['#drive_logs:job-' + currentJob.id]: 'View logs'
                  },
                });
              }
              if (currentJob.type === 'git_push') {
                filterSplit(driveJobs, removeOldByType('git_push'));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Git push failed',
                  type: 'git_push:failed',
                  err: err.message,
                  links: {
                    ['#drive_logs:job-' + currentJob.id]: 'View logs'
                  },
                });
              }
              if (currentJob.type === 'sync_all') {
                filterSplit(driveJobs, removeOldByType('sync_all'));
                filterSplit(driveJobs, removeOldSingleJobs(null));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync all failed',
                  type: 'sync:failed',
                  err: err.message,
                  links: {
                    ['#drive_logs:job-' + currentJob.id]: 'View logs'
                  },
                  payload: 'all'
                });
              }
              if (currentJob.type === 'sync') {
                filterSplit(driveJobs, removeOldSingleJobs(currentJob.payload));
                this.engine.emit(driveId, 'toasts:added', {
                  title: 'Sync failed',
                  type: 'sync:failed',
                  err: err.message,
                  payload: currentJob.payload
                });
              }

              const logger = this.engine.logger.child({ filename: __filename, driveId: driveId, jobId: currentJob.id });
              logger.error(err.stack ? err.stack : err.message);

              currentJob.state = 'failed';
              currentJob.finished = +new Date();
              this.setDriveJobs(driveId, driveJobs);
            });
        }
      } catch (err) {
        this.engine.logger.error(err.stack ? err.stack : err.message);
      }
    }, 100);
  }

  private async transform(folderId: FileId, jobId: string, filesIds: FileId[] = []) {
    const transformContainer = new TransformContainer({
      name: folderId,
      jobId
    }, { filesIds });
    const transformedFileSystem = await this.filesService.getSubFileService(folderId + '_transform', '/');
    const googleFileSystem = await this.filesService.getSubFileService(folderId, '/');
    await transformContainer.mount2(
      googleFileSystem,
      transformedFileSystem
    );

    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    transformContainer.onProgressNotify(({ completed, total, warnings, failed }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'transform');
      if (job) {
        job.progress = {
          completed: completed,
          total: total,
          failed: failed,
          warnings
        };
        this.engine.emit(folderId, 'jobs:changed', this.driveJobsMap[folderId]);
      }
    });
    await this.engine.registerContainer(transformContainer);
    try {
      await transformContainer.run(folderId);
      if (transformContainer.failed()) {
        throw new Error('Transform failed');
      }

      const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);
      const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
      await markdownTreeProcessor.load();

    } finally {
      await this.engine.unregisterContainer(transformContainer.params.name);
    }
  }

  private async upload(folderId: FileId, jobId: string, access_token: string) {
    const uploadContainer = new UploadContainer({
      cmd: 'pull',
      name: folderId,
      folderId: folderId,
      jobId,
      apiContainer: 'google_api',
      access_token
    });

    const generatedFileService = await this.filesService.getSubFileService(folderId + '_transform', '/');
    const googleFileSystem = await this.filesService.getSubFileService(folderId, '/');
    await uploadContainer.mount2(
      googleFileSystem,
      generatedFileService
    );

    uploadContainer.onProgressNotify(({ completed, total, warnings }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'upload');
      if (job) {
        job.progress = {
          completed: completed,
          total: total,
          warnings
        };
        this.engine.emit(folderId, 'jobs:changed', this.driveJobsMap[folderId]);
      }
    });
    await this.engine.registerContainer(uploadContainer);
    try {
      await uploadContainer.run();
    } finally {
      await this.engine.unregisterContainer(uploadContainer.params.name);
    }
  }

  private async sync(folderId: FileId, jobId: string, filesIds: FileId[] = []) {
    const downloadContainer = new GoogleFolderContainer({
      cmd: 'pull',
      name: folderId,
      folderId: folderId,
      jobId,
      apiContainer: 'google_api'
    }, { filesIds });

    downloadContainer.setForceDownloadFilters(filesIds.length === 1);

    await downloadContainer.mount(await this.filesService.getSubFileService(folderId, '/'));
    downloadContainer.onProgressNotify(({ completed, total, warnings }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'sync_all');
      if (job) {
        job.progress = {
          completed: completed,
          total: total,
          warnings
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

  private async runAction(folderId: FileId, jobId: string, trigger: string, payload: string, user?: { name: string, email: string }) {
    const runActionContainer = new ActionRunnerContainer({
      name: folderId,
      jobId,
      trigger,
      payload,
      user_name: user?.name || 'WikiGDrive',
      user_email: user?.email || 'wikigdrive@wikigdrive.com'
    });
    const generatedFileService = await this.filesService.getSubFileService(folderId + '_transform', '/');
    const googleFileSystem = await this.filesService.getSubFileService(folderId, '/');
    const tempPath = fs.mkdtempSync(path.join(this.filesService.getRealPath(), 'temp-'));
    const tempFileService = new FileContentService(tempPath);
    await runActionContainer.mount3(
      googleFileSystem,
      generatedFileService,
      tempFileService
    );
    await this.engine.registerContainer(runActionContainer);
    try {
      await runActionContainer.run(folderId);
      if (runActionContainer.failed()) {
        throw new Error('One on action steps has failed');
      }
    } finally {
      fs.rmSync(tempPath, { recursive: true, force: true });
      await this.engine.unregisterContainer(runActionContainer.params.name);
    }
  }

  private async gitPull(driveId: FileId, jobId: string) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });
    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);
      const userConfig = await userConfigService.load();

      await gitScanner.pullBranch(userConfig.remote_branch, {
        privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
      });

      await this.schedule(driveId, {
        ...initJob(),
        type: 'run_action',
        title: 'Run action: on git_pull',
        trigger: 'git_pull'
      });

      return {};
    } catch (err) {
      logger.error(err.stack ? err.stack : err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

  private async gitPush(driveId: FileId, jobId: string) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });

    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);
      const userConfig = await userConfigService.load();

      await gitScanner.pushBranch(userConfig.remote_branch, {
        privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
      });

      return {};
    } catch (err) {
      logger.error(err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

  private async gitCommit(driveId: FileId, jobId: string, message: string, filePaths: string[], removeFilePaths: string[], user) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const fileAssetsPaths = [];
    for (const path of filePaths.filter(path => path.endsWith('.md'))) {
      const assetsPath = path.substring(0, path.length - 3) + '.assets';
      if (await transformedFileSystem.exists(assetsPath)) {
        fileAssetsPaths.push(assetsPath);
      }
    }
    const removeFileAssetsPaths = [];
    for (const fileToRemove of removeFilePaths
        .filter(path => path.endsWith('.md'))
        .map(path => path.substring(0, path.length - 3) + '.assets')) {

      if (!await transformedFileSystem.exists(fileToRemove)) {
        continue;
      }
      removeFileAssetsPaths.push(fileToRemove + '/' + fileToRemove);
    }

    filePaths.push(...fileAssetsPaths);
    removeFilePaths.push(...removeFileAssetsPaths);

    await gitScanner.commit(message, filePaths, removeFilePaths, user);

    await this.schedule(driveId, {
      ...initJob(),
      type: 'run_action',
      title: 'Run action: on commit',
      trigger: 'commit',
      user
    });
  }

  private async gitReset(driveId: FileId, jobId: string, type: string) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });

    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);
      const userConfig = await userConfigService.load();
      const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);
      const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);

      switch (type) {
        case 'local':
          await gitScanner.resetToLocal({
            privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
          });

          await markdownTreeProcessor.regenerateTree(driveId);
          await markdownTreeProcessor.save();
          break;
        case 'remote':
          {
            await gitScanner.resetToRemote(userConfig.remote_branch, {
              privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
            });

            await markdownTreeProcessor.regenerateTree(driveId);
            await markdownTreeProcessor.save();
          }
          break;
      }

      await this.schedule(driveId, {
        ...initJob(),
        type: 'run_action',
        title: 'Run action: on git_reset',
        trigger: 'git_reset'
      });
    } catch (err) {
      logger.error(err.message);
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
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
      if (treeItem?.modifiedTime && treeItem.modifiedTime < change.modifiedTime) {
        filesToRetry.push(change);
      }
    }

    const now = +new Date();
    if (filesToRetry.length > 0) {
      for (const change of filesToRetry) {
        await this.schedule(driveId, {
          ...initJob(),
          type: 'sync',
          startAfter: now + 10 * 1000,
          payload: change.id,
          title: 'Retry syncing file: ' + (change.title || change.name)
        });
      }
    }
  }

  private async runJob(driveId: FileId, currentJob: Job, driveJobs: DriveJobs) {
    const logger = this.engine.logger.child({ filename: __filename, driveId: driveId, jobId: currentJob.id });
    logger.info('runJob ' + driveId + ' ' + JSON.stringify(currentJob));
    switch (currentJob.type) {
      case 'sync':
        await this.sync(driveId, currentJob.id, currentJob.payload.split(','));
        break;
      case 'sync_all':
        await this.sync(driveId, currentJob.id);
        break;
      case 'transform':
        try {
          await this.transform(driveId, currentJob.id, currentJob.payload ? [ currentJob.payload ] : [] );
          await this.clearGitCache(driveId);

          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('transform'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Transform done',
            type: 'transform:done',
            payload: currentJob.payload || 'all'
          });

          await this.schedule(driveId, {
            ...initJob(),
            type: 'run_action',
            title: 'Run action: on ' + currentJob.type,
            payload: currentJob.payload || 'all',
            trigger: currentJob.type
          });
        } catch (err) {
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('transform'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Transform failed',
            type: 'transform:failed',
            err: err.message,
            links: {
              ['#drive_logs:job-' + currentJob.id]: 'View logs'
            },
            payload: currentJob.payload || 'all'
          });
          throw err;
        }
        break;
      case 'run_action':
        try {
          await this.runAction(driveId, currentJob.id, currentJob.trigger, currentJob.payload, currentJob.user);
          await this.clearGitCache(driveId);

          this.engine.emit(driveId, 'toasts:added', {
            title: 'Action done',
            type: 'run_action:done',
          });
        } catch (err) {
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Action failed',
            type: 'run_action:failed',
            err: err.message,
            links: {
              ['#drive_logs:job-' + currentJob.id]: 'View logs'
            }
          });
          throw err;
        } finally {
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('run_action'));
        }
        break;
      case 'git_pull':
        try {
          await this.gitPull(driveId, currentJob.id);
          await this.clearGitCache(driveId);
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('git_pull'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Git pull done',
            type: 'git_pull:done',
            links: {
              '#git_log': 'View git history'
            },
          });

          await this.schedule(driveId, {
            ...initJob(),
            type: 'transform',
            title: 'Transform markdown'
          });
        } catch (err) {
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('git_pull'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Git pull failed',
            type: 'git_pull:failed',
            err: err.message,
            links: {
              ['#drive_logs:job-' + currentJob.id]: 'View logs'
            },
          });
          throw err;
        }
        break;
      case 'git_push':
        await this.gitPush(driveId, currentJob.id);
        await this.clearGitCache(driveId);
        break;
      case 'git_commit':
        {
          const { message, filePaths, removeFilePaths, user } = JSON.parse(currentJob.payload);
          await this.gitCommit(driveId, currentJob.id, message, filePaths, removeFilePaths, user);
          await this.clearGitCache(driveId);
        }
        break;
      case 'git_reset':
        await this.gitReset(driveId, currentJob.id, currentJob.payload);
        await this.clearGitCache(driveId);
        break;
      case 'upload':
        await this.upload(driveId, currentJob.id, currentJob.access_token);
        break;

    }
  }

  async clearGitCache(driveId: FileId) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    await clearCachedChanges(googleFileSystem);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

}
