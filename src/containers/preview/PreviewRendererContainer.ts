import {Container, ContainerEngine} from '../../ContainerEngine';
import {FileId} from '../../model/model';
import winston from 'winston';
import Docker from 'dockerode';
import {fileURLToPath} from 'url';
import {BufferWritable} from '../../utils/BufferWritable';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);

export class PreviewRendererContainer extends Container {
  private logger: winston.Logger;

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.name });
  }

  async run(driveId: FileId) {
    if (!process.env.RENDER_IMAGE) {
      return;
    }
    if (!process.env.VOLUME_DATA) {
      return;
    }
    if (!process.env.VOLUME_PREVIEW) {
      return;
    }
    if (!process.env.DOMAIN) {
      return;
    }

    const config = await this.filesService.readJson('.user_config.json') || {};

    const themeId = config?.hugo_theme?.id;
    const themeUrl = config?.hugo_theme?.url;
    const themeSubPath = config?.hugo_theme?.path || '';
    const configToml = config?.config_toml || '#relativeURLs = true\n' +
      'languageCode = "en-us"\n' +
      'title = "My New Hugo Site"\n';

    if (!themeUrl || !themeId) {
      return;
    }

    const docker = new Docker({socketPath: '/var/run/docker.sock'});


    await this.filesService.mkdir('tmp_dir');

    const configTomlPrefix = `theme="${themeId}"\nbaseURL="${process.env.DOMAIN}/preview/${driveId}/${themeId}/"\n`;
    await this.filesService.writeFile('tmp_dir/config.toml', configTomlPrefix + configToml);

    try {
      const writable = new BufferWritable();
      const result = await docker.run(process.env.RENDER_IMAGE, [], writable, {
        HostConfig: {
          Binds: [
            `${process.env.VOLUME_DATA}/${driveId}_transform:/site/content`,
            `${process.env.VOLUME_PREVIEW}/${driveId}/${themeId}:/site/public`,
            `${this.filesService.getRealPath()}/tmp_dir:/site/tmp_dir`
          ]
        },
        Env: [
          `BASE_URL=${process.env.DOMAIN}/preview/${driveId}/${themeId}/`,
          `THEME_ID=${themeId}`,
          `THEME_SUBPATH=${themeSubPath}`,
          `THEME_URL=${themeUrl}`
        ]
      });

      if (result?.length > 0 && result[0].StatusCode > 0) {
        this.logger.error(writable.getBuffer().toString());
      } else {
        this.logger.info(writable.getBuffer().toString());
      }
    } catch (err) {
      console.error(err);
      this.logger.error(err.message);
    }

    // fs.unlinkSync(`${tempDir}/config.toml`);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }
}
