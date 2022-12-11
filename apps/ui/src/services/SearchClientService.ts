export class SearchClientService {
  constructor(private authenticatedClient) {
  }

  async search(driveId, query) {
    if (!query) {
      return [];
    }

    const response = await this.authenticatedClient.fetchApi(`/api/search/${driveId}?q=${encodeURIComponent(query)}`);
    return await response.json();
  }
}
