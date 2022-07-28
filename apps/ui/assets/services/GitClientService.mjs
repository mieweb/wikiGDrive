export class GitClientService {

  constructor(authenticatedClient) {
    this.authenticatedClient = authenticatedClient;
  }

  async getHistory(driveId, path) {
    const response = await this.authenticatedClient.fetchApi(`/api/git/${driveId}/history${path}`);
    return await response.json();
  }

}
