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

}
