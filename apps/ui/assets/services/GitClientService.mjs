export class GitClientService {

  async getHistory(driveId, path) {
    const response = await fetch(`/api/git/${driveId}/history${path}`);
    return await response.json();
  }

}
