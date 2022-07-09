import WebSocket from 'ws';
import {ContainerEngine} from '../../ContainerEngine';
import {DriveJobs, JobManagerContainer} from '../job/JobManagerContainer';
import {FileId} from '../../model/model';

export class SocketManager {

  constructor(private engine: ContainerEngine) {
    this.engine.subscribe('jobs:changed', (driveId, driveJobs: DriveJobs) => {
      this.onJobsChanged(driveId, driveJobs);
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

    ws.on('message', (data) => {
      try {
        const json = JSON.parse(data.toString());
        ws.send(JSON.stringify({
          cmd: 'test',
          payload: {
            driveId,
            cmd: json.cmd
          }
        }));
      } catch (ignoreParseError) {} // eslint-disable-line no-empty
    });

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
}
