import yaml from 'js-yaml';
import path from 'path';
import fs from 'fs';
import {spawn} from 'child_process';
import {FileContentService} from '../../utils/FileContentService';
import {FRONTMATTER_DUMP_OPTS} from '../transform/frontmatters/frontmatter';

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
  hugo_theme?: string;
}

export class UserConfigService {

  public config: UserConfig;

  constructor(private fileService: FileContentService) {}

  async load(): Promise<UserConfig> {
    if (await this.fileService.exists('.user_config.yaml')) {
      const yamlContent = await this.fileService.readFile('.user_config.yaml');
      this.config = yaml.load(yamlContent);
    } else {
      this.config = {
        remote_branch: 'master'
      };
      await this.save();
    }
    return this.config;
  }

  async save(): Promise<void> {
    const fmt = yaml.dump(this.config, FRONTMATTER_DUMP_OPTS);
    await this.fileService.writeFile('.user_config.yaml', fmt);
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
