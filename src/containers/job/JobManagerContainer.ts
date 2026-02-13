import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

import Sandbox from '@nyariv/sandboxjs';

import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine.ts';
import {FileId} from '../../model/model.ts';
import {GoogleFolderContainer} from '../google_folder/GoogleFolderContainer.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor.ts';
import {WorkerPool} from './WorkerPool.ts';
import {GitScanner} from '../../git/GitScanner.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {CACHE_PATH} from '../server/routes/FolderController.ts';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer.ts';
import {ActionRunnerContainer, convertActionYaml} from '../action/ActionRunnerContainer.ts';
import {getContentFileService} from '../transform/utils.ts';
import {UploadContainer} from '../google_folder/UploadContainer.ts';
import {startDockerProxy} from '../action/dockerProxy.ts';

const __filename = import.meta.filename;

export type JobType = 'sync' | 'sync_all' | 'transform' | 'git_fetch' | 'git_pull' | 'git_push' | 'git_reset' | 'git_commit' | 'run_action' | 'upload';
export type JobState = 'waiting' | 'running' | 'failed' | 'done';

export function initJob(): { id: string, state: JobState } {
  return {
    id: crypto.randomUUID(),
    state: 'waiting'
  };
}

export interface Job {
  id: string;
  state: JobState;
  progress?: { total: number; completed: number; warnings: number; failed?: number };
  type: JobType;
  title: string;
  trigger?: string;
  action_id?: string;
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
    startDockerProxy(5000, '/var/run/docker.sock');
    startDockerProxy(5001, '/var/run/podman/podman.sock');
    this.workerPool = new WorkerPool(os.cpus().length);
  }

  async getDriveJobs(driveId: FileId): Promise<DriveJobs> {
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

  async setDriveJobs(driveId: FileId, driveJobs: DriveJobs) {
    if (driveJobs) {
      this.driveJobsMap[driveId] = driveJobs;
    }
    this.engine.emit(driveId, 'jobs:changed', driveJobs);
    const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
    await driveFileSystem.writeJson('.jobs.json', driveJobs);
  }

  async scheduleWorker(type: string, payload: unknown): Promise<unknown> {
    this.engine.logger.info(`scheduleWorker: ${type}`);
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
        {
          const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
          const userConfigService = new UserConfigService(googleFileSystem);
          await userConfigService.load();
          const config = userConfigService.config;
          const workflow = await convertActionYaml(config.actions_yaml);

          const actionId = job.action_id ? job.action_id : workflow.on[job.trigger];
          const workflowJob = workflow.jobs[actionId];
          if (workflowJob && workflowJob.name) {
            job.title = workflowJob.name;
            job.action_id = actionId;
            driveJobs.jobs.push(job);

            this.engine.emit(driveId, 'toasts:added', {
              title: 'Scheduled: ' + workflowJob.name,
              message: JSON.stringify(job, null, 2),
              type: 'action:scheduled',
              payload: job.payload ? job.payload : 'all'
            });
          }
        }
        break;
      case 'git_fetch':
        if (driveJobs.jobs.find(subJob => subJob.type === 'git_fetch' && notCompletedJob(subJob))) {
          return;
        }
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
              if (err instanceof AggregateError) {
                for (const subErr of err.errors) {
                  logger.error(subErr.stack ? subErr.stack : subErr.message);
                }
              } else {
                if (err.message.indexOf('Process exited') === -1) { // Already in log
                  logger.error(err.stack ? err.stack : err.message);
                }
              }

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
    downloadContainer.onProgressNotify(({ completed, total, warnings, failed }) => {
      if (!this.driveJobsMap[folderId]) {
        return;
      }
      const jobs = this.driveJobsMap[folderId].jobs || [];
      const job = jobs.find(j => j.state === 'running' && j.type === 'sync_all');
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
    await this.engine.registerContainer(downloadContainer);
    try {
      await downloadContainer.run();
    } finally {
      await this.engine.unregisterContainer(downloadContainer.params.name);
    }

    const jobs = this.driveJobsMap[folderId].jobs || [];
    const job = jobs.find(j => j.state === 'running' && j.type === 'sync_all');

    if (job?.progress?.failed) {
      throw new Error('Sync failed');
    } else {
      await this.schedule(folderId, {
        ...initJob(),
        type: 'run_action',
        title: 'Run action: on sync',
        trigger: 'internal/sync',
        payload: JSON.stringify({
          selectedFileId: filesIds.length === 1 ? filesIds[0] : null
        })
      });
    }
  }

  private async runAction(folderId: FileId, jobId: string, action_id: string, payload: string, user?: { name: string, email: string }) {
    const runActionContainer = new ActionRunnerContainer({
      name: folderId,
      jobId,
      action_id,
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

  private async gitFetch(driveId: FileId, jobId: string) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });
    try {
      const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
      const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
      await gitScanner.initialize();

      const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
      const userConfigService = new UserConfigService(googleFileSystem);

      await gitScanner.fetch({
        privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
      });

      await this.schedule(driveId, {
        ...initJob(),
        type: 'run_action',
        title: 'Run action: on git_fetch',
        trigger: 'git_fetch'
      });

      return {};
    } catch (err) {
      if (err.message.indexOf('Process exited') === -1) { // Already in log
        logger.error(err.stack ? err.stack : err.message);
      }
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
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
      if (err.message.indexOf('Process exited') === -1) { // Already in log
        logger.error(err.stack ? err.stack : err.message);
      }
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
      if (err.message.indexOf('Process exited') === -1) { // Already in log
        logger.error(err.stack ? err.stack : err.message);
      }
      if (err.message.indexOf('Failed to retrieve list of SSH authentication methods') > -1) {
        return { error: 'Failed to authenticate' };
      }
      throw err;
    }
  }

  private async gitCommit(driveId: FileId, jobId: string, message: string, filePaths: string[], user) {
    const logger = this.engine.logger.child({ filename: __filename, driveId, jobId });

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const gitScanner = new GitScanner(logger, transformedFileSystem.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const googleFileSystem = await this.filesService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    const userConfig = await userConfigService.load();

    // Check if local branch is behind remote and sync if needed
    if (userConfig.remote_branch) {
      try {
        await gitScanner.fetch({
          privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
        });

        const { ahead, behind } = await gitScanner.countAheadBehind(userConfig.remote_branch);
        
        if (ahead > 0 && behind > 0) {
          throw new Error('Local and remote branches have diverged. Please manually sync your repository before committing.');
        }
        
        if (behind > 0) {
          logger.info(`Local branch is ${behind} commit(s) behind remote. Syncing before commit...`);
          
          // Stash local changes - returns true if something was stashed
          const stashed = await gitScanner.stashChanges();
          
          try {
            // Pull with rebase to integrate remote changes (uses git pull --rebase internally)
            await gitScanner.pullBranch(userConfig.remote_branch, {
              privateKeyFile: await userConfigService.getDeployPrivateKeyPath()
            });
            
            // Apply stashed changes if we stashed something
            if (stashed) {
              await gitScanner.stashPop();
              
              // Check for conflicts after stash pop
              if (await gitScanner.hasConflicts()) {
                throw new Error('Stash pop resulted in merge conflicts. Cannot proceed with commit. ' +
                  'Please resolve conflicts manually using "Reset and Pull" or by running git commands directly.');
              }
            }
          } catch (err) {
            // If pull fails, leave stash intact for manual recovery
            // The user can use "Reset and Pull" to clean up or `git stash list` to view saved changes
            if (stashed) {
              logger.warn('Pull failed. Stashed changes remain saved for manual recovery. ' +
                'Use `git stash list` to view stashed changes or "Reset and Pull" to clean up.');
            }
            throw err;
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Failed to retrieve list of SSH authentication methods')) {
          throw new Error('Failed to authenticate with remote repository: ' + err.message);
        }
        throw err;
      }
    }

    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);
    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();

    if (userConfig.companion_files_rule) {
      gitScanner.setCompanionFileResolver(async (filePath: string) => {
        if (!filePath.endsWith('.md')) {
          return [];
        }

        let subdir = (userConfigService.config.transform_subdir || '')
          .replace(/^\//, '')
          .replace(/\/$/, '');
        if (subdir.length > 0) {
          subdir += '/';
        }

        filePath = filePath
          .replace(/^\//, '')
          .substring(subdir.length);

        const tuple = await markdownTreeProcessor.findByPath('/' + filePath);

        const treeItem = tuple[0];
        if (!treeItem) {
          return [];
        }

        const retVal: Set<string> = new Set();

        const sandbox = new Sandbox.default();
        const exec = sandbox.compile('return ' + (userConfig.companion_files_rule || 'false'));

        await markdownTreeProcessor.walkTree((treeNode) => {
          const commit = {
            path: subdir + treeItem.path.replace(/^\//, ''),
            id: treeItem.id,
            fileName: treeItem.fileName,
            mimeType: treeItem.mimeType,
            redirectTo: treeItem.redirectTo
          };
          const file = {
            path: subdir + treeNode.path.replace(/^\//, ''),
            id: treeNode.id,
            fileName: treeNode.fileName,
            mimeType: treeNode.mimeType,
            redirectTo: treeNode.redirectTo
          };

          const result = exec({ commit, file }).run();

          if (result) {
            retVal.add(file.path);
          }
          return false;
        });
        return Array.from(retVal);
      });
    }

    await gitScanner.commit(message, filePaths, user);

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
      if (err.message.indexOf('Process exited') === -1) { // Already in log
        logger.error(err.stack ? err.stack : err.message);
      }
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
      case 'run_action':
        try {
          await this.runAction(driveId, currentJob.id, currentJob.action_id, currentJob.payload, currentJob.user);
          await this.clearGitCache(driveId); // TODO: check if necessary?

          await this.schedule(driveId, {
            ...initJob(),
            type: 'run_action',
            title: 'Run action:',
            trigger: currentJob.action_id
          });

          this.engine.emit(driveId, 'toasts:added', {
            title: 'Done: ' + currentJob.title,
            type: 'run_action:done',
            payload: this.params.payload
          });
        } catch (err) {
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Failed: ' + currentJob.title,
            type: 'run_action:failed',
            err: err.message,
            links: {
              ['#drive_logs:job-' + currentJob.id]: 'View logs'
            },
            payload: this.params.payload
          });
          throw err;
        }
        break;
      case 'git_fetch':
        try {
          await this.gitFetch(driveId, currentJob.id);
          await this.clearGitCache(driveId);
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('git_fetch'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Git fetch done',
            type: 'git_fetch:done',
            links: {
              '#git_log': 'View git history'
            },
          });
        } catch (err) {
          driveJobs.jobs = driveJobs.jobs.filter(removeOldByType('git_fetch'));
          this.engine.emit(driveId, 'toasts:added', {
            title: 'Git fetch failed',
            type: 'git_fetch:failed',
            err: err.message,
            links: {
              ['#drive_logs:job-' + currentJob.id]: 'View logs'
            },
          });
          throw err;
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
          const { message, filePaths, user } = JSON.parse(currentJob.payload);
          await this.gitCommit(driveId, currentJob.id, message, filePaths, user);
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

  progressJob(folderId: FileId, jobId: string,{ completed, total, warnings, failed }) {
    if (!this.driveJobsMap[folderId]) {
      return;
    }
    const jobs = this.driveJobsMap[folderId].jobs || [];
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.progress = {
        completed: completed,
        total: total,
        failed: failed,
        warnings
      };
      this.engine.emit(folderId, 'jobs:changed', this.driveJobsMap[folderId]);
    }
  }
}
