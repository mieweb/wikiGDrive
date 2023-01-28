import {FileService, pathResolve} from './FileService';
import identify from 'identify-filetype';

export class FileContentService extends FileService {

  protected readonly virtualPath;

  constructor(protected readonly rootPath: string = '/', virtualPath = '/') {
    super(rootPath);
    this.virtualPath = virtualPath || '/';
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
    } catch (error) {
      return null;
    }
  }

  async guessExtension(filePath: string) {
    const buffer = await this.readBuffer(filePath);
    return identify(buffer) || 'bin';
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
