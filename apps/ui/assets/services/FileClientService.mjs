export class FileClientService {

  constructor(authenticatedClient) {
    this.authenticatedClient = authenticatedClient;
  }

  async getFile(path) {
    const response = await this.authenticatedClient.fetchApi(`/api/file${path}`);

    const retVal = {
      path,
      googleId: response.headers.get('wgd-google-id'),
      mimeType: response.headers.get('Content-type').split(';')[0].trim(),
      treeEmpty: response.headers.get('wgd-tree-empty') === 'true',
      treeVersion: response.headers.get('wgd-tree-version')
    };

    if (retVal.mimeType === 'application/vnd.google-apps.folder') {
      retVal.files = await response.json();
      return retVal;
    }

    const text = await response.text();

    return {
      ...retVal,
      content: text
    };
  }

  async getBacklinks(driveId, fileId) {
    const response = await this.authenticatedClient.fetchApi(`/api/backlinks/${driveId}/${fileId}`);
    return await response.json();
  }

}
