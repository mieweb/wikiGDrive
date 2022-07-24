import {Container, ContainerEngine} from '../../ContainerEngine';
import {FileId} from '../../model/model';
import winston from 'winston';
import Docker from 'dockerode';
import {fileURLToPath} from 'url';
import {BufferWritable} from '../../utils/BufferWritable';

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

    if (!themeUrl || !themeId) {
      return;
    }

    const docker = new Docker({socketPath: '/var/run/docker.sock'});

    try {
      const writable = new BufferWritable();
      const result = await docker.run(process.env.RENDER_IMAGE, [], writable, {
        HostConfig: {
          Binds: [
            `${process.env.VOLUME_DATA}/${driveId}_transform:/site/content`,
            `${process.env.VOLUME_PREVIEW}/${driveId}/${themeId}:/site/public`
          ]
        },
        Env: [
          `BASE_URL=${process.env.DOMAIN}/preview/${driveId}/${themeId}/`,
          `THEME_ID=${themeId}`,
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


    /*
-e VOLUME_DATA=/var/lib/docker/volumes/wikiGDriveDevelop/_data \
-e VOLUME_PREVIEW=/var/www/preview-develop \
-e RENDER_IMAGE=hugo-render:develop \
-e DOMAIN=https://dev.wikigdrive.com \

          docker run \
            --env BASE_URL=$DOMAIN/preview/$1/$THEME_ID/ \
            --env THEME_ID=$THEME_ID \
            --env THEME_URL=$THEME_URL \
            --mount type=bind,source="$VOLUME_DATA/$1_transform",target=/site/content \
            --mount type=bind,source="$VOLUME_PREVIEW/$1/$THEME_ID",target=/site/public \
            $RENDER_IMAGE
    */
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }
}
