import {FileClientService} from './FileClientService.js';

export class CachedFileClientService extends FileClientService {
  private cache: any;

  constructor(authenticatedClient) {
    super(authenticatedClient);
    this.cache = {};
  }

  async clearCache() {
    this.cache = {};
  }

  async getFile(path) {
    if (this.cache[path]) {
      return this.cache[path];
    }
    const result = await super.getFile(path);
    this.cache[path] = result;
    return result;
  }

  async saveFile(path, content) {
    delete this.cache[path];
    return super.saveFile(path, content);
  }

  async removeFile(path) {
    await super.removeFile(path);

    const parts = path.split('/');
    parts.pop();
    const parentDir = parts.join('/');
    delete this.cache[parentDir];
    for (const key in this.cache) {
      if (key.startsWith(parentDir + '/')) {
        delete this.cache[key];
      }
    }
  }

}
