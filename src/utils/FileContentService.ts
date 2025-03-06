/* eslint-disable @typescript-eslint/no-explicit-any */

import { Buffer } from 'node:buffer';

import { getSignature } from 'file-isignature';

import {FileService, pathResolve} from './FileService.ts';

export class FileContentService extends FileService {

  protected readonly virtualPath;

  constructor(protected readonly rootPath: string = '/', virtualPath = '/') {
    super(rootPath);
    this.virtualPath = virtualPath || '/';
    if (!this.virtualPath.endsWith('/')) {
      this.virtualPath += '/';
    }
  }

  async readFile(filePath: string): Promise<string> {
    const buffer = await this.readBuffer(filePath);
    return buffer.toString('utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    return this.writeBuffer(filePath, Buffer.from(content));
  }

  async readJson(filePath) {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    }
  }

  async guessExtension(filePath: string) {
    const signature = getSignature(pathResolve(this.rootPath, filePath));
    return signature.value || 'bin';
  }

  async writeJson(filePath: string, data: any) {
    if (!data) {
      return;
    }
    await this.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getSubFileService(subPath: string, virtualPath?: string): Promise<FileContentService> {
    if (!subPath) {
      throw new Error('Empty subPath');
    }

    if (subPath.startsWith('/')) { // this.virtualPath always ends with '/'
      subPath = subPath.substring(1);
    }

    const subFileService = new FileContentService(
      pathResolve(this.rootPath, subPath),
      virtualPath !== undefined ? virtualPath : this.virtualPath + subPath + '/'
    );
    await subFileService.mkdir('/');
    return subFileService;
  }

  getVirtualPath() {
    return this.virtualPath;
  }

  getRealPath() {
    return this.rootPath;
  }
}
