import {FileClientService} from './FileClientService.mjs';

export class CachedFileClientService extends FileClientService {

  constructor(authenticatedClient) {
    super(authenticatedClient);
    this.cache = {};
  }

  clearCache() {
    this.cache = {};
  }

  async getFile(path) {
    if (!this.cache[path]) {
      this.cache[path] = await super.getFile(path);
    }
    return this.cache[path];
  }

  async removeFile(path) {
    await super.removeFile(path);

    const parts = path.split('/');
    parts.pop();
    const parentDir = parts.join('/')
    delete this.cache[parentDir];
    for (const key in this.cache) {
      if (key.startsWith(parentDir + '/')) {
        delete this.cache[key];
      }
    }
  }

}
