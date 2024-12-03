import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {Readable, Writable} from 'node:stream';

export function pathResolve(rootPath: string, ...args: string[]): string {
  const retVal = path.resolve(path.join(rootPath, ...args));
  if (!retVal.startsWith(rootPath)) {
    throw new Error('Access denied: ' + retVal + ' outside of ' + rootPath);
  }
  return retVal;
}

export class FileService {

  constructor(protected readonly rootPath: string = '/') {
    if (!this.rootPath) {
      throw new Error('Empty rootPath');
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    if (!await this.exists(dirPath)) {
      fs.mkdirSync(pathResolve(this.rootPath, dirPath), { recursive: true });
    }
  }

  async rmdir(dirPath: string): Promise<void> {
    if (await this.exists(dirPath)) {
      fs.rmSync(pathResolve(this.rootPath, dirPath), { recursive: true });
    }
  }

  async remove(filePath) {
    if (!await this.exists(filePath)) {
      return;
    }
    const stat = fs.statSync(pathResolve(this.rootPath, filePath));
    if (stat.isDirectory()) {
      await this.rmdir(filePath);
    }
    if (stat.isFile()) {
      fs.unlinkSync(pathResolve(this.rootPath, filePath));
    }
  }

  async isDirectory(filePath) {
    const stat = fs.statSync(pathResolve(this.rootPath, filePath));
    return stat.isDirectory();
  }

  async exists(filePath: string): Promise<boolean> {
    return fs.existsSync(pathResolve(this.rootPath, filePath));
  }

  async getSize(filePath: string): Promise<number> {
    const stats = fs.statSync(pathResolve(this.rootPath, filePath));
    return stats.size;
  }

  async getMtime(filePath: string): Promise<number> {
    const stats = fs.statSync(pathResolve(this.rootPath, filePath));
    return +stats.mtime;
  }

  readBuffer(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(pathResolve(this.rootPath, filePath), (err, data) => {
        if (err) return reject(err);

        resolve(data);
      });
    });
  }

  writeBuffer(filePath: string, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(pathResolve(this.rootPath, filePath), buffer, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  createWriteStream(filePath: string): Writable {
    const stream = fs.createWriteStream(pathResolve(this.rootPath, filePath));
    return stream;
  }

  createReadStream(filePath: string): Readable {
    return fs.createReadStream(pathResolve(this.rootPath, filePath));
  }

  md5File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      hash.setEncoding('hex');

      const fullFilePath = pathResolve(this.rootPath, filePath);
      if (!fs.existsSync(fullFilePath)) {
        return resolve(null);
      }
      const fd = fs.createReadStream(fullFilePath);
      fd
        .on('error', function (err) {
          reject(err);
        })
        .on('end', function () {
          hash.end();
          resolve(hash.read()); // the desired sha1sum
        });

      fd.pipe(hash);
    });
  }

  async move(path1: string, path2: string) {
    fs.renameSync(pathResolve(this.rootPath, path1), pathResolve(this.rootPath, path2));
  }

  async list(dirPath = ''): Promise<string[]> {
    const fullPath = pathResolve(this.rootPath, dirPath);
    if (!await this.exists(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(fullPath);
    return files;
  }

}
