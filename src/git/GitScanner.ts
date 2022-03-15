import * as SimpleGitPromise from 'simple-git';

import {SimpleGit} from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import {spawn} from 'child_process';

async function execAsync(cmd, params: string[] = []) {
  const process = spawn(cmd, params);

  process.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  process.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  await new Promise<void>((resolve, reject) => {
    process.on('exit', (code) => {
      if (code) {
        reject(code);
      } else {
        resolve();
      }
    });
  });
}


export class GitScanner {
  private repository: SimpleGit;

  constructor(private rootPath: string) {
    this.repository = SimpleGitPromise(this.rootPath);
  }

  async isRepo() {
    return await this.repository.checkIsRepo();
  }

  async commit(message: string, fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }
    if (fileName) {
      await this.repository.add([ fileName ]);
    }
    await this.repository.commit(message, [ fileName ]);
  }

  async push() {
    try {
      await this.repository.push('origin', 'master');
    } catch (err) {
      console.warn(err.message);
    }
  }

  async getRemoteUrl(): Promise<string> {
    const remotes = await this.repository.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    if (!origin) {
      return null;
    }
    return origin.refs?.push || null;
  }

  async setRemoteUrl(url) {
    try {
      await this.repository.removeRemote('origin');
      // eslint-disable-next-line no-empty
    } catch (ignore) {}
    await this.repository.addRemote('origin', url);
  }

  async getDeployKey() {
    const privatePath = path.join(this.rootPath, '.private');
    if (fs.existsSync(`${privatePath}/id_rsa.pub`)) {
      return fs.readFileSync(`${privatePath}/id_rsa.pub`).toString('utf-8');
    }
    return null;
  }

  async history(fileName: string) {
    if (fileName.startsWith('/')) {
      fileName = fileName.substring(1);
    }

/*
    const s = await this.repository.status({
      file: fileName
    });
    console.log('s', s);
*/

    try {
      const response = await this.repository.log({
        file: fileName
      });
      return response.all;
    } catch (err) {
      if (err.message.indexOf('does not have any commits yet') > 0) {
        return [];
      }
      console.error(err.message);
      return [];
    }
  }

  async initialize() {
    const privatePath = path.join(this.rootPath, '.private');
    if (!await this.isRepo()) {
      fs.writeFileSync(path.join(this.rootPath, '.gitignore'), '.private\n');
      if (!fs.existsSync(privatePath)) {
        fs.mkdirSync(privatePath);
        if (fs.existsSync(`${privatePath}/id_rsa`)) {
          fs.unlinkSync(`${privatePath}/id_rsa`);
        }
        if (fs.existsSync(`${privatePath}/id_rsa.pub`)) {
          fs.unlinkSync(`${privatePath}/id_rsa.pub`);
        }
        await execAsync('ssh-keygen', ['-f', `${privatePath}/id_rsa`, '-N \'\'']);
      }
      await this.repository.init();
    }
  }
}
