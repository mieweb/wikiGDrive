import WebSocket from 'ws';
import {ContainerEngine} from '../../ContainerEngine';
import {DriveJobs, JobManagerContainer} from '../job/JobManagerContainer';
import {FileId} from '../../model/model';
import {GoogleFile} from '../../model/GoogleFile';
import {WatchChangesContainer} from '../changes/WatchChangesContainer';

export class SocketManager {

  constructor(private engine: ContainerEngine) {
    this.engine.subscribe('jobs:changed', (driveId, driveJobs: DriveJobs) => {
      this.onJobsChanged(driveId, driveJobs);
    });
    this.engine.subscribe('changes:changed', (driveId, changes: GoogleFile) => {
      this.onChangesChanged(driveId, changes);
    });
  }

  socketsMap: {[driveId: string]: Set<WebSocket.WebSocket>} = {};

  async addSocketConnection(ws: WebSocket.WebSocket, driveId: string) {
    if (!this.socketsMap[driveId]) {
      this.socketsMap[driveId] = new Set<WebSocket.WebSocket>();
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


    const watchChangesContainer = <WatchChangesContainer>this.engine.getContainer('watch_changes');
    const changes = await watchChangesContainer.getChanges(driveId);
    ws.send(JSON.stringify({
      cmd: 'changes:changed',
      payload: changes
    }));

    ws.on('close', () => {
      this.socketsMap[driveId].delete(ws);
    });
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

  private onChangesChanged(driveId: FileId, changes: GoogleFile) {
    if (!this.socketsMap[driveId]) {
      return;
    }

    for (const socket of this.socketsMap[driveId]) {
      socket.send(JSON.stringify({
        cmd: 'changes:changed',
        payload: changes
      }));
    }
  }
}
