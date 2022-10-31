import path from 'path';
import fs from 'fs';
import {exec} from 'child_process';
import {FileContentService} from '../../utils/FileContentService';
import {HugoTheme} from '../server/routes/ConfigController';

async function execAsync(command: string) {
  const err = new Error();
  const stackList = err.stack.split('\n');

  await new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
      if (error) {
        const err = new Error(error.message);
        err.stack = stackList.slice(0, 1).concat(stackList.slice(2)).join('\n');
        return reject(err);
      }

      resolve({
        stdout, stderr
      });
    });
  });
}

export class UserConfig {
  remote_branch: string;
  hugo_theme?: HugoTheme;
  config_toml?: string;
  transform_subdir?: string;
  auto_sync?: boolean;
  fm_without_version?: boolean;
}

export class UserConfigService {

  public config: UserConfig;

  constructor(private fileService: FileContentService) {}

  async load(): Promise<UserConfig> {
    if (await this.fileService.exists('.user_config.json')) {
      const json = await this.fileService.readJson('.user_config.json');
      this.config = json || {};
    } else {
      this.config = {
        remote_branch: 'master'
      };
      await this.save();
    }
    return this.config;
  }

  async save(): Promise<void> {
    await this.fileService.writeJson('.user_config.json', this.config);
    await this.genKeys();
  }

  async getDeployPrivateKeyPath() {
    if (await this.fileService.exists('.private/id_rsa')) {
      return path.join(this.fileService.getRealPath(), '.private', 'id_rsa');
    }
    return null;
  }

  async getDeployPrivateKey() {
    if (await this.fileService.exists('.private/id_rsa')) {
      return await this.fileService.readFile('.private/id_rsa');
    }
    return null;
  }

  async getDeployKey() {
    if (await this.fileService.exists('.private/id_rsa.pub')) {
      return await this.fileService.readFile('.private/id_rsa.pub');
    }
    return null;
  }

  async genKeys(force = false) {
    const privatePath = path.join(this.fileService.getRealPath(), '.private');
    if (!fs.existsSync(privatePath)) {
      fs.mkdirSync(privatePath);
    } else {
      if (!force) {
        return;
      }
    }

    if (fs.existsSync(`${privatePath}/id_rsa`)) {
      fs.unlinkSync(`${privatePath}/id_rsa`);
    }
    if (fs.existsSync(`${privatePath}/id_rsa.pub`)) {
      fs.unlinkSync(`${privatePath}/id_rsa.pub`);
    }
    await execAsync(`ssh-keygen -t ecdsa -b 521 -f ${privatePath}/id_rsa -q -N ""`);
  }
}
