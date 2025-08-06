import {ContainerEngine} from '../../ContainerEngine.ts';
import {DriveJobs, JobManagerContainer, Toast} from '../job/JobManagerContainer.ts';
import {FileId} from '../../model/model.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {WatchChangesContainer} from '../changes/WatchChangesContainer.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {getContentFileService} from '../transform/utils.ts';

export interface Socket {
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: Socket, ev: WebSocketEventMap[K]) => any
  ): void;
}

export class SocketManager<SK extends Socket> {

  socketsMap: {[driveId: string]: Set<SK>} = {};
  private fileService!: FileContentService;

  constructor(private engine: ContainerEngine) {
    this.engine.subscribe('jobs:changed', (driveId, driveJobs: DriveJobs) => {
      this.onJobsChanged(driveId, driveJobs);
    });
    this.engine.subscribe('toasts:added', (driveId, toast: Toast) => {
      this.onToastsAdded(driveId, toast);
    });
    this.engine.subscribe('changes:changed', (driveId, changes: GoogleFile[]) => {
      this.onChangesChanged(driveId, changes);
    });
  }

  async mount(fileService: FileContentService) {
    this.fileService = fileService;
  }

  async addSocketConnection(ws: SK, driveId: string) {
    if (!this.socketsMap[driveId]) {
      this.socketsMap[driveId] = new Set<SK>();
    }

    this.socketsMap[driveId].add(ws);
    ws.send(JSON.stringify({
      cmd: 'connected'
    }));
    const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
    const driveJobs = await jobManagerContainer.inspect(driveId);
    ws.send(JSON.stringify({
      cmd: 'jobs:changed',
      payload: driveJobs
    }));


    if (this.engine.hasContainer('watch_changes')) {
      const watchChangesContainer = <WatchChangesContainer>this.engine.getContainer('watch_changes');
      const changes = await watchChangesContainer.getChanges(driveId);
      const filteredChanges = await this.getFilteredChanges(driveId, changes);
      ws.send(JSON.stringify({
        cmd: 'changes:changed',
        payload: filteredChanges
      }));
    }

    ws.addEventListener('close', () => {
      this.socketsMap[driveId].delete(ws);
    });
  }

  private onToastsAdded(driveId: FileId, toast: Toast) {
    if (!this.socketsMap[driveId]) {
      return;
    }

    for (const socket of this.socketsMap[driveId]) {
      socket.send(JSON.stringify({
        cmd: 'toasts:added',
        payload: toast
      }));
    }
  }

  private onJobsChanged(driveId: FileId, driveJobs: DriveJobs) {
    if (!this.socketsMap[driveId]) {
      return;
    }

    for (const socket of this.socketsMap[driveId]) {
      socket.send(JSON.stringify({
        cmd: 'jobs:changed',
        payload: driveJobs
      }));
    }
  }

  async getFilteredChanges(driveId: FileId, changes: GoogleFile[]): Promise<GoogleFile[]> {
    let filteredChanges = [];

    const googleFileSystem = await this.fileService.getSubFileService(driveId, '');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.fileService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);
    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();

    if (!markdownTreeProcessor.isEmpty()) {
      for (const change of changes) {
        const fileId = change.id;
        const [file, drivePath] = await markdownTreeProcessor.findById(fileId);
        if (file && drivePath) {
          if (file.modifiedTime !== change.modifiedTime) {
            filteredChanges.push(change);
          }
        }
      }
    } else {
      filteredChanges = changes;
    }

    return filteredChanges;
  }

  private async onChangesChanged(driveId: FileId, changes: GoogleFile[]) {
    if (!this.socketsMap[driveId]) {
      return;
    }

    const filteredChanges = await this.getFilteredChanges(driveId, changes);

    for (const socket of this.socketsMap[driveId]) {
      socket.send(JSON.stringify({
        cmd: 'changes:changed',
        payload: filteredChanges
      }));
    }
  }
}
