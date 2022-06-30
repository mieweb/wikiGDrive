export class DriveClientService {

  async getDrives() {
    const response = await fetch(`/api/drive`);
    return response.json();
  }

  async changeDrive(driveId) {
    const oldDrive = this.driveId;
    this.driveId = driveId;
    if (oldDrive !== driveId) {
      await this.connectSocket(this.driveId)
    }
    if (!driveId) {
      return {};
    }
    const response = await fetch(`/api/drive/${driveId}`);
    return response.json();
  }

  connectSocket(driveId) {
    console.log('connectSocket', driveId);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (!driveId) {
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${wsProtocol}//${window.location.host}/api/${driveId}`);
    this.socket.onopen = () => {
      setInterval(() => {
        this.socket.send('inspect');
      }, 2000);
    };

    this.socket.onclose = () => {
      this.connectSocket(this.driveId);
    }
  }

}
