import {FileClientService} from './FileClientService.ts';

export class CachedFileClientService extends FileClientService {
  private cache: {[key: string]: string};

  constructor(authenticatedClient) {
    super(authenticatedClient);
    this.cache = {};
  }

  async clearCache() {
    this.cache = {};
  }

  async getFile(path: string) {
    if (this.cache[path]) {
      return this.cache[path];
    }
    const result = await super.getFile(path);
    this.cache[path] = result;
    return result;
  }

  async saveFile(path: string, content: string) {
    delete this.cache[path];
    return super.saveFile(path, content);
  }

  async removeFile(path: string) {
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
