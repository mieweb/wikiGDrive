import {Container, ContainerEngine} from '../../ContainerEngine';
import {FileId} from '../../model/model';
import winston from 'winston';
import Docker from 'dockerode';
import {fileURLToPath} from 'url';
import {BufferWritable} from '../../utils/BufferWritable';
import {UserConfigService} from '../google_folder/UserConfigService';
import yaml from 'js-yaml';
import {GitScanner} from '../../git/GitScanner';
import {FileContentService} from '../../utils/FileContentService';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);

export interface ActionStep {
  name?: string;
  uses: string;
  env?: {[key: string]: string};
}

export interface ActionDefinition {
  on: string;
  steps: Array<ActionStep>;
}

export const DEFAULT_ACTIONS: ActionDefinition[] = [
  {
    on: 'transform',
    steps: [
      {
        name: 'auto_commit',
        uses: 'auto_commit',
      },
      {
        name: 'render_hugo',
        uses: 'render_hugo',
      }
    ]
  },
  {
    on: 'branch',
    steps: [
      {
        uses: 'commit_branch'
      },
      {
        uses: 'push_branch'
      }
    ]
  },
  {
    on: 'git_reset',
    steps: [
      {
        name: 'render_hugo',
        uses: 'render_hugo',
      }
    ]
  },
  {
    on: 'git_pull',
    steps: [
      {
        name: 'render_hugo',
        uses: 'render_hugo',
      }
    ]
  }
];

export class ActionRunnerContainer extends Container {
  private logger: winston.Logger;
  private generatedFileService: FileContentService;
  private userConfigService: UserConfigService;
  private tempFileService: FileContentService;
  private isErr = false;

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.name, jobId: this.params.jobId });
  }

  async convertActionYaml(actionYaml: string): Promise<ActionDefinition[]> {
    const actionDefs: ActionDefinition[] = actionYaml ? yaml.load(actionYaml) : DEFAULT_ACTIONS;
    return actionDefs;
  }

  async mount3(fileService: FileContentService, destFileService: FileContentService, tempFileService: FileContentService): Promise<void> {
    this.filesService = fileService;
    this.generatedFileService = destFileService;
    this.tempFileService = tempFileService;
    this.userConfigService = new UserConfigService(this.filesService);
    await this.userConfigService.load();
  }

  async runDocker(driveId: FileId, generatedFileService: FileContentService, step: ActionStep, config): Promise<number> {
    if (!process.env.ACTION_IMAGE) {
      this.logger.error('No env.ACTION_IMAGE');
      return -1;
    }
    if (!process.env.VOLUME_DATA) {
      this.logger.error('No env.VOLUME_DATA');
      return -1;
    }
    if (!process.env.VOLUME_PREVIEW) {
      this.logger.error('No env.VOLUME_PREVIEW');
      return -1;
    }
    if (!process.env.DOMAIN) {
      this.logger.error('No env.DOMAIN');
      return -1;
    }

    let code = 0;
    const themeUrl = config?.hugo_theme?.url || '';
    const themeSubPath = config?.hugo_theme?.path || '';

    const driveIdTransform: string = path.basename(generatedFileService.getRealPath());

    const contentDir = config.transform_subdir ?
      `/${driveIdTransform}${ !config.transform_subdir.startsWith('/') ? '/' : '' }${config.transform_subdir}` :
      `/${driveIdTransform}`;
    const docker = new Docker({socketPath: '/var/run/docker.sock'});

    const themeId = config?.hugo_theme?.id || '';
    const configToml = config?.config_toml || '#relativeURLs = true\n' +
      'languageCode = "en-us"\n' +
      'title = "My New Hugo Site"\n';

    await this.filesService.mkdir('tmp_dir');

    if (themeId) {
      const configTomlPrefix = `theme="${themeId}"\n`;
      await this.filesService.writeFile('tmp_dir/config.toml', configTomlPrefix + configToml);
    } else {
      await this.filesService.writeFile('tmp_dir/config.toml', configToml);
    }

    const committer = {
      name: this.params.user_name || 'WikiGDrive',
      email: this.params.user_email || 'wikigdrive@wikigdrive.com'
    };

    const additionalEnv = this.payloadToEnv();

    try {
      const writable = new BufferWritable();

      let result;

      if (themeId) {
        const env = ['render_hugo', 'exec', 'commit_branch'].includes(step.uses) ? Object.assign({
          CONFIG_TOML: '/site/tmp_dir/config.toml',
          BASE_URL: `${process.env.DOMAIN}/preview/${driveId}/${themeId}/`,
          THEME_ID: themeId,
          THEME_SUBPATH: themeSubPath,
          THEME_URL: themeUrl,
          GIT_AUTHOR_NAME: committer.name,
          GIT_AUTHOR_EMAIL: committer.email,
          GIT_COMMITTER_NAME: committer.name,
          GIT_COMMITTER_EMAIL: committer.email
        }, step.env, additionalEnv) : Object.assign({}, step.env, additionalEnv);

        this.logger.info(`DockerAPI:\ndocker run \\
        --user=${process.getuid()} \\
        -v "${process.env.VOLUME_DATA}/${driveId}_transform:/repo" \\
        -v "${process.env.VOLUME_DATA}${contentDir}:/site/content" \\
        -v "${process.env.VOLUME_PREVIEW}/${driveId}/${themeId}:/site/public" \\
        -v "${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/tmp_dir" \\
        -v "${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/resources" \\
        ${Object.keys(env).map(key => `--env ${key}="${env[key]}"`).join(' ')} \\
        ${process.env.ACTION_IMAGE} /steps/step_${step.uses}
        `);

        result = await docker.run(process.env.ACTION_IMAGE, [`/steps/step_${step.uses}`], writable, {
          HostConfig: {
            Binds: [
              `${process.env.VOLUME_DATA}/${driveId}_transform:/repo`,
              `${process.env.VOLUME_DATA}${contentDir}:/site/content`,
              `${process.env.VOLUME_PREVIEW}/${driveId}/${themeId}:/site/public`,
              `${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/tmp_dir`,
              `${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/resources`
            ]
          },
          Env: Object.keys(env).map(key => `${key}=${env[key]}`),
          User: String(process.getuid())
        });
      } else {
        const env = ['render_hugo', 'exec', 'commit_branch'].includes(step.uses) ? Object.assign({
          CONFIG_TOML: '/site/tmp_dir/config.toml',
          BASE_URL: `${process.env.DOMAIN}/preview/${driveId}/_manual/`,
          GIT_AUTHOR_NAME: committer.name,
          GIT_AUTHOR_EMAIL: committer.email,
          GIT_COMMITTER_NAME: committer.name,
          GIT_COMMITTER_EMAIL: committer.email
        }, step.env, additionalEnv) : Object.assign({}, step.env, additionalEnv);

        this.logger.info(`DockerAPI:\ndocker run \\
          --user=${process.getuid()} \\
          -v "${process.env.VOLUME_DATA}/${driveId}_transform:/repo" \\
          -v "${process.env.VOLUME_DATA}/${driveIdTransform}:/site" \\
          -v "${process.env.VOLUME_DATA}${contentDir}:/site/content" \\
          -v "${process.env.VOLUME_PREVIEW}/${driveId}/_manual:/site/public" \\
          -v "${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/tmp_dir" \\
          -v "${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/resources" \\
          ${Object.keys(env).map(key => `--env ${key}="${env[key]}"`).join(' ')} \\
          ${process.env.ACTION_IMAGE} /steps/step_${step.uses}
        `);

        result = await docker.run(process.env.ACTION_IMAGE, [`/steps/step_${step.uses}`], writable, {
          HostConfig: {
            Binds: [
              `${process.env.VOLUME_DATA}/${driveId}_transform:/repo`,
              `${process.env.VOLUME_DATA}/${driveIdTransform}:/site`,
              `${process.env.VOLUME_DATA}${contentDir}:/site/content`,
              `${process.env.VOLUME_PREVIEW}/${driveId}/_manual:/site/public`,
              `${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/tmp_dir`,
              `${process.env.VOLUME_DATA}/${driveId}/tmp_dir:/site/resources`
            ]
          },
          Env: Object.keys(env).map(key => `${key}=${env[key]}`),
          User: String(process.getuid())
        });
      }

      if (result?.length > 0 && result[0].StatusCode > 0) {
        this.logger.error(writable.getBuffer().toString());
        code = result[0].StatusCode;
      } else {
        this.logger.info(writable.getBuffer().toString());
      }
    } catch (err) {
      code = err.statusCode || 1;
      this.logger.error(err.stack ? err.stack : err.message);
    }
    return code;
  }

  async run(driveId: FileId) {
    const config = this.userConfigService.config;

    const gitScanner = new GitScanner(this.logger, this.generatedFileService.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const ownerRepo = await gitScanner.getOwnerRepo();

    this.isErr = false;

    const actionDefs = await this.convertActionYaml(config.actions_yaml);
    for (const actionDef of actionDefs) {
      if (actionDef.on !== this.params['trigger']) {
        continue;
      }

      if (actionDef.on === 'commit') {
        await gitScanner.pushToDir(this.tempFileService.getRealPath());
      }
      const generatedFileService = actionDef.on === 'commit' ? this.tempFileService : this.generatedFileService;

      if (!Array.isArray(actionDef.steps)) {
        throw new Error('No action steps');
      }

      for (const step of actionDef.steps) {
        this.logger.info('Step: ' + (step.name || step.uses));

        if (!step.env) {
          step.env = {};
        }
        step.env['OWNER_REPO'] = ownerRepo;
        step.env['PAYLOAD'] = this.params.payload;

        let lastCode = 0;
        switch (step.uses) {
          case 'push_branch':
            {
              const additionalEnv = this.payloadToEnv();
              await gitScanner.pushBranch(`wgd/${additionalEnv['BRANCH']}`, {
                privateKeyFile: await this.userConfigService.getDeployPrivateKeyPath()
              }, `wgd/${additionalEnv['BRANCH']}`);
            }
            break;
          case 'auto_commit':
            {
              await gitScanner.autoCommit();
            }
            break;
          default:
            lastCode = await this.runDocker(driveId, generatedFileService, step, config);
            break;
        }
        if (0 !== lastCode) {
          this.isErr = true;
          break;
        }
      }
    }

    // fs.unlinkSync(`${tempDir}/config.toml`);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  private payloadToEnv() {
    const additionalEnv = {};
    additionalEnv['REMOTE_BRANCH'] = this.userConfigService.config?.remote_branch || 'master';

    if (this.params.payload && this.params.payload.startsWith('{')) {
      try {
        const payload = JSON.parse(this.params.payload);
        additionalEnv['BRANCH'] = payload.branch || '';
        additionalEnv['MESSAGE'] = payload.message || '';
        additionalEnv['FILES'] = Array.isArray(payload.filePaths) ? payload.filePaths.join(' ') : '';
      } catch (err) {
        this.logger.error(err.stack ? err.stack : err.message);
      }
    }
    return additionalEnv;
  }

  public failed() {
    return this.isErr;
  }
}
