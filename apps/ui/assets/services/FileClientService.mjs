export class FileClientService {

  currentFetches = {};

  constructor(authenticatedClient) {
    this.authenticatedClient = authenticatedClient;
  }

  async getFile(path) {
    if (this.currentFetches[path]) {
      return this.currentFetches[path];
    }

    this.currentFetches[path] = new Promise(async (resolve, reject) => {
      try {
        const response = await this.authenticatedClient.fetchApi(`/api/file${path}`);

        const retVal = {
          path,
          googleId: response.headers.get('wgd-google-id'),
          mimeType: response.headers.get('Content-type').split(';')[0].trim(),
          treeEmpty: response.headers.get('wgd-tree-empty') === 'true',
          treeVersion: response.headers.get('wgd-tree-version'),
          contentDir: response.headers.get('wgd-content-dir'),
        };

        if (retVal.mimeType === 'application/vnd.google-apps.folder') {
          retVal.files = await response.json();
          delete this.currentFetches[path];
          resolve(retVal);
        }

        const text = await response.text();

        delete this.currentFetches[path];
        resolve({
          ...retVal,
          content: text
        });
      } catch (err) {
        delete this.currentFetches[path];
        reject(err);
      }
    });

    return this.currentFetches[path];
  }

  async getBacklinks(driveId, fileId) {
    const response = await this.authenticatedClient.fetchApi(`/api/backlinks/${driveId}/${fileId}`);
    return await response.json();
  }

}
