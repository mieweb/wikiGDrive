export class FileClientService {

  async getFile(path) {
    const response = await fetch(`/api/file${path}`);

    const retVal = {
      path,
      googleId: response.headers.get('wgd-google-id'),
      mimeType: response.headers.get('Content-type').split(';')[0].trim()
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
    const response = await fetch(`/api/backlinks/${driveId}/${fileId}`);
    return await response.json();
  }

}
