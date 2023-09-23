import path from 'path';
import fs from 'fs';
import {exec} from 'child_process';
import yaml from 'js-yaml';
import {FileContentService} from '../../utils/FileContentService';
import {HugoTheme} from '../server/routes/ConfigController';
import {FRONTMATTER_DUMP_OPTS} from '../transform/frontmatters/frontmatter';
import {DEFAULT_ACTIONS} from '../action/ActionRunnerContainer';

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
  actions_yaml?: string;
}

const DEFAULT_CONFIG: UserConfig = {
  remote_branch: 'master',
  hugo_theme: {
    id: 'ananke',
    name: 'Anake',
    url: 'https://github.com/budparr/gohugo-theme-ananke.git',
    preview_img: 'https://raw.githubusercontent.com/budparr/gohugo-theme-ananke/master/images/screenshot.png'
  }
};

export class UserConfigService {

  public config: UserConfig;

  constructor(private fileService: FileContentService) {}

  async load(): Promise<UserConfig> {
    if (await this.fileService.exists('.user_config.json')) {
      const json = await this.fileService.readJson('.user_config.json');
      this.config = json || {};
    } else {
      this.config = structuredClone(DEFAULT_CONFIG);
      await this.save();
    }
    if (!this.config.actions_yaml) {
      this.config.actions_yaml = yaml.dump(DEFAULT_ACTIONS, FRONTMATTER_DUMP_OPTS);
    }

    return this.config;
  }

  async save(): Promise<void> {
    await this.fileService.writeJson('.user_config.json', this.config);
    await this.genKeys();
  }

  async getDeployPrivateKeyPath() {
    if (await this.fileService.exists('.private/id_rsa')) {
      const fullPath = path.join(this.fileService.getRealPath(), '.private', 'id_rsa');
      fs.chmodSync(fullPath, '0600');
      return fullPath;
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
