import path from 'path';
import fs from 'fs';
import {spawn} from 'child_process';
import {FileContentService} from '../../utils/FileContentService';
import {HugoTheme} from '../server/routes/ConfigController';

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

export class UserConfig {
  remote_branch: string;
  hugo_theme?: HugoTheme;
  config_toml?: string;
  transform_subdir?: string;
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

  async genKeys() {
    const privatePath = path.join(this.fileService.getRealPath(), '.private');
    if (!fs.existsSync(privatePath)) {
      fs.mkdirSync(privatePath);
      if (fs.existsSync(`${privatePath}/id_rsa`)) {
        fs.unlinkSync(`${privatePath}/id_rsa`);
      }
      if (fs.existsSync(`${privatePath}/id_rsa.pub`)) {
        fs.unlinkSync(`${privatePath}/id_rsa.pub`);
      }
      await execAsync('ssh-keygen', ['-t', 'ecdsa', '-b', '521', '-f', `${privatePath}/id_rsa`, '-q',  '-N', 'sekret']);
    }
  }
}
