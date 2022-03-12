import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine';
import * as winston from 'winston';
import {FileId} from '../../model/model';
import {GoogleFolderContainer} from '../google_folder/GoogleFolderContainer';
import {TransformContainer} from '../transform/TransformContainer';

export type JobType = 'sync' | 'sync_all';
export type JobState = 'waiting' | 'running';

export interface Job {
  type: JobType;
  state?: JobState;
  payload?: string;
  ts?: number;
}

export interface DriveJobs {
  driveId: FileId;
  jobs: Job[];
}

export interface DriveJobsMap {
  [driveId: FileId]: DriveJobs;
}

export class JobManagerContainer extends Container {
  private logger: winston.Logger;

  private driveJobsMap: DriveJobsMap = {};

  constructor(public readonly params: ContainerConfig) {
    super(params);
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
  }

  async schedule(driveId: FileId, job: Job) {
    job.state = 'waiting';
    job.ts = +new Date();
    if (!this.driveJobsMap[driveId]) {
      this.driveJobsMap[driveId] = {
        driveId, jobs: []
      };
    }

    const driveJobs = this.driveJobsMap[driveId];

    switch (job.type) {
      case 'sync':
        for (const subJob of driveJobs.jobs) {
          if (subJob.type === 'sync_all') {
            return;
          }
          if (subJob.type === job.type && subJob.payload === job.payload) {
            return;
          }
        }
        driveJobs.jobs.push(job);
        break;
      case 'sync_all':
        if (driveJobs.jobs.find(subJob => subJob.type === 'sync_all')) {
          return;
        }
        driveJobs.jobs = driveJobs.jobs.filter(subJob => subJob.state === 'running');
        driveJobs.jobs.push(job);
        break;
    }

    this.driveJobsMap[driveId] = driveJobs;
  }

  async ps(): Promise<DriveJobsMap> {
    return this.driveJobsMap;
  }

  async inspect(driveId: FileId): Promise<DriveJobs> {
    return this.driveJobsMap[driveId] || {
      driveId,
      jobs: []
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async run() {
    setInterval(() => {
      const now = +new Date();
      for (const driveId in this.driveJobsMap) {
        const driveJobs = this.driveJobsMap[driveId];
        if (driveJobs.jobs.length === 0) {
          delete this.driveJobsMap[driveId];
          continue;
        }

        const lastTs = driveJobs.jobs[driveJobs.jobs.length - 1].ts;
        if (now - lastTs < 1000) {
          continue;
        }

        if (driveJobs.jobs[0].state === 'running') {
          continue;
        }

        driveJobs.jobs[0].state = 'running';
        this.runJob(driveId, driveJobs.jobs[0])
          .then(() => {
            driveJobs.jobs = driveJobs.jobs.filter(subJob => subJob.state === 'waiting');
          })
          .catch(err => {
            this.logger.error(err);
            driveJobs.jobs = driveJobs.jobs.filter(subJob => subJob.state === 'waiting');
          });
      }
    }, 500);
  }

  private async sync(folderId: FileId, filesIds: FileId[] = []) {
    const downloadContainer = new GoogleFolderContainer({
      cmd: 'pull',
      name: folderId,
      folderId: folderId,
      apiContainer: 'google_api'
    }, { filesIds });
    await downloadContainer.mount(await this.filesService.getSubFileService(folderId, '/'));
    await this.engine.registerContainer(downloadContainer);
    await downloadContainer.run();
    await this.engine.unregisterContainer(downloadContainer.params.name);

    const transformContainer = new TransformContainer({
      name: folderId
    }, { filesIds });
    await transformContainer.mount2(
      await this.filesService.getSubFileService(folderId, '/'),
      await this.filesService.getSubFileService(folderId + '_transform', '/')
    );
    await this.engine.registerContainer(transformContainer);
    await transformContainer.run(folderId);
    await this.engine.unregisterContainer(transformContainer.params.name);
  }

  private async runJob(folderId: FileId, job: Job) {
    this.logger.info('runJob ' + folderId + ' ' + JSON.stringify(job));
    switch (job.type) {
      case 'sync':
        await this.sync(folderId, [ job.payload ]);
        break;
      case 'sync_all':
        await this.sync(folderId);
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

}
