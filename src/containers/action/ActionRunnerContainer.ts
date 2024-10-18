import * as path from 'path';
import {fileURLToPath} from 'url';
import winston from 'winston';
import yaml from 'js-yaml';

import {Container, ContainerEngine} from '../../ContainerEngine.ts';
import {FileId} from '../../model/model.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {GitScanner} from '../../git/GitScanner.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {DockerContainer} from './DockerContainer.ts';

const __filename = fileURLToPath(import.meta.url);

export interface ActionStep {
  name?: string;
  uses: string;
  with?: {[key: string]: string};
  env?: {[key: string]: string};
}

export interface ActionDefinition {
  on: string;
  'run-name'?: string;
  steps: Array<ActionStep>;
}

export const DEFAULT_ACTIONS: ActionDefinition[] = [
  {
    on: 'transform',
    'run-name': 'AutoCommit and Render',
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
    'run-name': 'Commit and Push branch',
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
    'run-name': 'Render',
    steps: [
      {
        name: 'render_hugo',
        uses: 'render_hugo',
      }
    ]
  },
  {
    on: 'git_pull',
    'run-name': 'Render',
    steps: [
      {
        name: 'render_hugo',
        uses: 'render_hugo',
      }
    ]
  }
];

export async function convertActionYaml(actionYaml: string): Promise<ActionDefinition[]> {
  const actionDefs: ActionDefinition[] = actionYaml ? yaml.load(actionYaml) : DEFAULT_ACTIONS;
  return actionDefs;
}

function withToEnv(map: { [p: string]: string }) {
  const retVal = {};
  if (map) {
    for (const key in map) {
      retVal['INPUT_' + key.replace(/ /g, '_').toUpperCase()] = map[key];
    }
  }
  return retVal;
}

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

  async mount3(fileService: FileContentService, destFileService: FileContentService, tempFileService: FileContentService): Promise<void> {
    this.filesService = fileService;
    this.generatedFileService = destFileService;
    this.tempFileService = tempFileService;
    this.userConfigService = new UserConfigService(this.filesService);
    await this.userConfigService.load();
  }

  async run(driveId: FileId) {
    if (!process.env.ACTION_IMAGE) {
      this.logger.error('No env.ACTION_IMAGE');
      this.isErr = true;
      return;
    }
    if (!process.env.VOLUME_DATA) {
      this.logger.error('No env.VOLUME_DATA');
      this.isErr = true;
      return;
    }
    if (!process.env.VOLUME_PREVIEW) {
      this.logger.error('No env.VOLUME_PREVIEW');
      this.isErr = true;
      return;
    }
    if (!process.env.DOMAIN) {
      this.logger.error('No env.DOMAIN');
      this.isErr = true;
      return;
    }

    const config = this.userConfigService.config;

    const gitScanner = new GitScanner(this.logger, this.generatedFileService.getRealPath(), 'wikigdrive@wikigdrive.com');
    await gitScanner.initialize();

    const ownerRepo = await gitScanner.getOwnerRepo();

    this.isErr = false;

    const actionDefs = await convertActionYaml(config.actions_yaml);
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

      const driveIdTransform: string = path.basename(generatedFileService.getRealPath());

      const committer = {
        name: this.params.user_name || 'WikiGDrive',
        email: this.params.user_email || 'wikigdrive@wikigdrive.com'
      };

      const additionalEnv = this.payloadToEnv();

      const writable = new BufferWritable();

      // await this.generatedFileService.remove('resources');

/*      const env = ['render_hugo', 'exec', 'commit_branch'].includes(step.uses) ? Object.assign({
        CONFIG_TOML: '/site/tmp_dir/config.toml',
        BASE_URL: `${process.env.DOMAIN}/preview/${driveId}/_manual/`,
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email
      }, step.env, additionalEnv) : Object.assign({}, step.env, additionalEnv);*/

      const env = Object.assign({
        CONFIG_TOML: '/site/tmp_dir/config.toml',
        BASE_URL: `${process.env.DOMAIN}/preview/${driveId}/_manual/`,
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email
      }, additionalEnv);

      //--user=$(id -u):$(getent group docker | cut -d: -f3)
      this.logger.info(`DockerAPI:\ndocker start \\
        --user=${process.getuid()}:${process.getegid()} \\
        // -v "${process.env.VOLUME_DATA}/${driveId}_transform:/repo:ro" \\
        // -v "${process.env.VOLUME_DATA}/${driveIdTransform}:/site:rw" \\
        // --mount "type=tmpfs,destination=/site/resources" \\
        ${Object.keys(env).map(key => `--env ${key}="${env[key]}"`).join(' ')} \\
        ${process.env.ACTION_IMAGE}
      `);

      const container = new DockerContainer(process.env.ACTION_IMAGE);

      try {
        await container.create(env, writable);
        await container.start();
        this.logger.info('container created: ' + container.id);

        this.logger.info('docker cp . /site');
        await container.copy(generatedFileService.getRealPath(), '/site');

        // Convert to step:
        const configToml = config?.config_toml || '#relativeURLs = true\n' +
          'languageCode = "en-us"\n' +
          'title = "My New Hugo Site"\n';
        this.logger.info('docker write /site/tmp_dir/config.toml');
        await container.putFile(new TextEncoder().encode(configToml), '/site/tmp_dir/config.toml');
        //

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
              this.logger.info(`docker exec ${container.id} /steps/step_${step.uses}`);
              try {
                if (step.uses.indexOf('/') > -1 && step.uses.indexOf('@') > -1) {
                  const [action_repo, action_version] = step.uses.split('@');
                  lastCode = await container.exec(`/steps/step_gh_action ${action_repo} ${action_version}`, Object.assign(step.env, withToEnv(step.with)));
                } else {
                  lastCode = await container.exec(`/steps/step_${step.uses}`, Object.assign(step.env, withToEnv(step.with)));
                }
                if (lastCode > 0) {
                  this.logger.error(writable.getBuffer().toString());
                } else {
                  this.logger.info(writable.getBuffer().toString());
                }
              } catch (err) {
                this.logger.error(err.stack ? err.stack : err.message);
                lastCode = 1;
              }
              break;
          }
          if (0 !== lastCode) {
            this.isErr = true;
            break;
          }
        }

        // Convert to step
        const previewOutput = `${process.env.VOLUME_PREVIEW}/${driveId}/_manual`;
        this.logger.info('docker export /site/public ' + previewOutput);
        await container.export('/site/public', previewOutput);
        //

        this.logger.info('Action completed');

      } catch (err) {
        this.logger.error(err.stack ? err.stack : err.message);
        this.isErr = true;
      } finally {
        await container.stop();
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  private payloadToEnv() {
    const additionalEnv = {};
    additionalEnv['REMOTE_BRANCH'] = this.userConfigService.config?.remote_branch || 'main';

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
