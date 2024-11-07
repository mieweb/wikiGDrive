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
import {PodmanContainer} from './PodmanContainer.ts';
import {ActionTransform} from './ActionTransform.ts';

const __filename = fileURLToPath(import.meta.url);

export interface ActionStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: {[key: string]: string};
  env?: {[key: string]: string};
}

export interface ActionDefinitionLegacy {
  on: string;
  'run-name'?: string;
  steps: Array<ActionStep>;
}

export interface WorkflowJob {
  name: string;
  'runs-on'?: string;
  steps: Array<ActionStep>;
  hide_in_menu?: boolean;
}

export interface WorkflowDefinition {
  on: {[trigger: string]: string};

  jobs: {
    [key: string]: WorkflowJob
  }
}

export const DEFAULT_WORKFLOW: WorkflowDefinition = {
  on: {
    'internal/sync': 'transform_all',
    'transform_all': 'autocommit_render',
    'transform_single': 'autocommit_render',
    'internal/branch': 'commit_and_push_branch'
  },

  jobs: {
    'transform_all': {
      name: 'Transform All',
      steps: [
        {
          uses: 'internal/transform',
          with: {
            'selectedFileId': null
          }
        }
      ]
    },
    'transform_single': {
      name: 'Transform Single',
      steps: [
        {
          uses: 'internal/transform',
          with: {
            'selectedFileId': '$wgd.selectedFileId'
          }
        }
      ]
    },
    'autocommit_render': {
      name: 'AutoCommit and Render',
      steps: [
        {
          name: 'internal/auto_commit',
          uses: 'internal/auto_commit',
        },
        {
          name: 'internal/render_hugo',
          uses: 'internal/render_hugo',
        },
        {
          name: 'Export preview to nginx',
          uses: 'internal/export_preview'
        }
      ]
    },
    'commit_and_push_branch': {
      name: 'Commit and Push branch',
      hide_in_menu: true,
      steps: [
        {
          uses: 'internal/commit_branch'
        },
        {
          uses: 'internal/push_branch'
        }
      ]
    }
  }
  // name: 'Check PR Labels'
  // runs-on: ubuntu-latest

};

function migrateStep(step: ActionStep): ActionStep {
  if (step.uses === 'exec' && step.env?.EXEC) {
    return {
      name: step.name,
      run: step.env.EXEC
    };
  }

  if (step.uses === 'auto_commit') {
    step.uses = 'internal/auto_commit';
  }
  if (step.uses === 'commit_branch') {
    step.uses = 'internal/commit_branch';
  }

  return step;
}

export function migrateLegacy(actionDefs: ActionDefinitionLegacy[]): WorkflowDefinition {
  const retVal: WorkflowDefinition = DEFAULT_WORKFLOW;

  for (const actionDef of actionDefs) {
    switch (actionDef.on) {
      case 'transform':
        retVal.jobs['autocommit_render'].steps = actionDef.steps.map(step => migrateStep(step));
        retVal.jobs['autocommit_render'].steps.push(        {
          name: 'Export preview to nginx',
          uses: 'internal/export_preview'
        });
        break;
    }
  }

  for (const jobId in retVal.jobs) {
    const job = retVal.jobs[jobId];
    job['runs-on'] = 'docker';
  }

  return retVal;
}

export async function convertActionYaml(actionYaml: string): Promise<WorkflowDefinition> {
  if (!actionYaml) {
    return DEFAULT_WORKFLOW;
  }

  const yamlObj = yaml.load(actionYaml);
  const workflow: WorkflowDefinition = (Array.isArray(yamlObj)) ? migrateLegacy(yamlObj) : yamlObj;

  return workflow;
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

    const workflow = await convertActionYaml(config.actions_yaml);
    const workflowJobId = workflow.on[this.params['trigger']] || this.params['action_id'];

    if (workflow.jobs[workflowJobId]) {
      const workflowJob = workflow.jobs[workflowJobId];
      if (this.params['trigger'] === 'commit') {
         await gitScanner.pushToDir(this.tempFileService.getRealPath());
      }
      const generatedFileService = this.params['trigger'] === 'commit' ? this.tempFileService : this.generatedFileService;

      const steps = workflowJob.steps;
      if (!Array.isArray(steps)) {
        throw new Error('No action steps');
      }

      const committer = {
        name: this.params.user_name || 'WikiGDrive',
        email: this.params.user_email || 'wikigdrive@wikigdrive.com'
      };

      const additionalEnv = this.payloadToEnv();

      const writable = new BufferWritable();

      const env = Object.assign({
        CONFIG_TOML: '/site/tmp_dir/config.toml',
        BASE_URL: `${process.env.DOMAIN}/preview/${driveId}/_manual/`,
        GIT_AUTHOR_NAME: committer.name,
        GIT_AUTHOR_EMAIL: committer.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email
      }, additionalEnv);

      const container = workflowJob['runs-on'] === 'podman' ?
        await PodmanContainer.create(this.logger, 'localhost/' + process.env.ACTION_IMAGE, env, `/${driveId}_transform`) :
        await DockerContainer.create(this.logger, process.env.ACTION_IMAGE, env, generatedFileService.getRealPath());


      try {
        container.skipMount = (steps.length === 1 && steps[0].uses === 'internal/transform');
        await container.start();
        // await container.mountOverlay(generatedFileService.getRealPath(), '/site');

        // TODO: Convert to step
        const configToml = config?.config_toml || 'languageCode = "en-us"\ntitle = "My New Hugo Site"\n';
        await container.putFile(new TextEncoder().encode(configToml), '/site/tmp_dir/config.toml');

        for (const step of steps) {
          if (!step.env) {
            step.env = {};
          }
          step.env['OWNER_REPO'] = ownerRepo;
          step.env['PAYLOAD'] = this.params.payload;

          let lastCode = 0;

          if (step.run) {
            this.logger.info('Step: ' + (step.name || step.run));

            try {
              lastCode = await container.exec(step.run, Object.assign(step.env, withToEnv(step.with)), writable);
              if (lastCode > 0) {
                this.logger.error('err: '+new TextDecoder().decode(writable.getBuffer()));
              } else {
                this.logger.info(new TextDecoder().decode(writable.getBuffer()));
              }
            } catch (err) {
              this.logger.error(err.stack ? err.stack : err.message);
              lastCode = 1;
            }
          } else
          if (step.uses) {
            this.logger.info('Step: ' + (step.name || step.uses));

            switch (step.uses) {
              case 'internal/transform':
                try {
                  const action = new ActionTransform(this.engine, this.filesService, this.generatedFileService);
                  let selectedFileId = undefined;
                  try {
                    const payload = JSON.parse(this.params.payload);

                    if (step.with?.selectedFileId === '$wgd.selectedFileId') {
                      selectedFileId = payload.selectedFileId;
                    }
                  } catch (ignore) { /* empty */ }
                  await action.execute(driveId, this.params.jobId, selectedFileId ? [ selectedFileId ] : [] );
                } catch (err) {
                  this.logger.error(err.stack ? err.stack : err.message);
                  lastCode = 1;
                }
                break;

              case 'internal/push_branch':
              {
                const additionalEnv = this.payloadToEnv();
                await gitScanner.pushBranch(`wgd/${additionalEnv['BRANCH']}`, {
                  privateKeyFile: await this.userConfigService.getDeployPrivateKeyPath()
                }, `wgd/${additionalEnv['BRANCH']}`);
              }
                break;
              case 'internal/auto_commit':
              {
                gitScanner.debug = true;
                await gitScanner.setSafeDirectory();
                await gitScanner.autoCommit();
              }
                break;
              default:
                try {
                  if (step.uses.indexOf('/') > -1 && step.uses.indexOf('@') > -1) {
                    const [action_repo, action_version] = step.uses.split('@');
                    lastCode = await container.exec(`/steps/step_gh_action ${action_repo} ${action_version}`, Object.assign(step.env, withToEnv(step.with)), writable);
                  } else {
                    lastCode = await container.exec(`/steps/step_${step.uses}`, Object.assign(step.env, withToEnv(step.with)), writable);
                  }
                  if (lastCode > 0) {
                    this.logger.error('err: '+new TextDecoder().decode(writable.getBuffer()));
                  } else {
                    this.logger.info(new TextDecoder().decode(writable.getBuffer()));
                  }
                } catch (err) {
                  this.logger.error(err.stack ? err.stack : err.message);
                  lastCode = 1;
                }
                break;
              case 'internal/export_preview':
              {
                const previewOutput = `${process.env.VOLUME_PREVIEW}/${driveId}/_manual`;
                await container.export('/site/public', previewOutput);
              }
                break;
            }
          }
          if (0 !== lastCode) {
            this.isErr = true;
            break;
          }
        }

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
