import path from 'node:path';
import {PassThrough, type Writable} from 'node:stream';
import type { Buffer } from 'node:buffer';
// import {Buffer} from 'https://deno.land/std/io/buffer.ts';

import Docker from 'dockerode';
import tarFs from 'tar-fs';
import tarStream from 'tar-stream';
import winston from 'winston';

import {OciContainer} from './OciContainer.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';
import process from 'node:process';
import fs from 'node:fs';

export class DockerContainer implements OciContainer {
  private constructor(private logger: winston.Logger,
                      public readonly id: string,
                      public readonly image: string,
                      private container: typeof Docker.Container,
                      private volume: typeof Docker.Volume,
                      private dirs: string[]) {
  }

  static async create(logger: winston.Logger, image: string, env: { [p: string]: string }, repoSubDir: string): Promise<OciContainer> {
    // https://github.com/apocas/dockerode/issues/747
    // const dockerEngine = new Docker({socketPath: '/var/run/docker.sock'});

    const dockerEngine = new Docker({ protocol: 'http', host: 'localhost', port: 5000 });

    const upper = fs.mkdtempSync(path.join('/srv/overlay_mounts', `${env.DRIVE_ID}-upper`));
    const workdir = fs.mkdtempSync(path.join('/srv/overlay_mounts', `${env.DRIVE_ID}-workdir`));

    try {
      const container = await dockerEngine.getContainer(`${env.DRIVE_ID}_job`);
      if (container) {
        await container.remove({
          force: true
        });
      }
      // deno-lint-ignore no-unused-vars
      // deno-lint-ignore no-empty
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (ignoredError) { /* empty */ }

    try {
      const volume = await dockerEngine.getVolume(`${env.DRIVE_ID}_overlay_site`);
      if (volume) {
        await volume.remove({
          force: true
        });
      }
      // deno-lint-ignore no-unused-vars
      // deno-lint-ignore no-empty
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (ignoredError) { /* empty */ }

    const volume = await dockerEngine.createVolume({
      'Name': `${env.DRIVE_ID}_overlay_site`,
      'Driver': 'local',
      'DriverOpts': {
        'type': 'overlay',
        'o': `lowerdir=${process.env.VOLUME_DATA}/${repoSubDir},upperdir=${upper},workdir=${workdir}`,
        'device': 'overlay'
      }
    });

    const container = await dockerEngine.createContainer({
      Name: `${env.DRIVE_ID}_job`,
      Image: image,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
      HostConfig: {
        Binds: [ // Unlike Mounts those are created if not existing in the host
          `${process.env.VOLUME_DATA}/${env.DRIVE_ID}/action-cache:/action-cache:rw`,
          `${process.env.VOLUME_PREVIEW}/${env.DRIVE_ID}:/output-preview:rw`
        //   `${process.env.VOLUME_DATA}/${driveId}_transform:/repo:ro`,
        //   `${process.env.VOLUME_DATA}/${driveIdTransform}:/site:rw`,
        //   `${process.env.VOLUME_DATA}${contentDir}:/site/content:rw`,
        ],
        Mounts: [
          {
            'Type': 'volume',
            'Source': `${env.DRIVE_ID}_overlay_site`,
            'Target': '/site',
            'VolumeOptions': {
              'Driver': 'local',
              'DriverOpts': {
                'type': 'overlay',
                'o': `lowerdir=${process.env.VOLUME_DATA}${repoSubDir},upperdir=${upper},workdir=${workdir}`,
                'device': 'overlay'
              }
            }
          }
        ]
      },
      Env: Object.keys(env).map(key => `${key}=${env[key]}`),
      User: String(process.getuid())+ ':' + String(process.getegid())
    });

    //--user=$(id -u):$(getent group docker | cut -d: -f3)
    // logger.info(`DockerAPI:\ndocker start \\
    //     --user=${process.getuid()}:${process.getegid()} \\
    //     // -v "${process.env.VOLUME_DATA}/${driveId}_transform:/repo:ro" \\
    //     // -v "${process.env.VOLUME_DATA}/${driveIdTransform}:/site:rw" \\
    //     // --mount "type=tmpfs,destination=/site/resources" \\
    //     ${Object.keys(env).map(key => `--env ${key}="${env[key]}"`).join(' ')} \\
    //     ${process.env.ACTION_IMAGE}
    //   `);

    return new DockerContainer(logger, container.id, image, container, volume, [ upper, workdir ]);
  }

  async start() {
    await this.container.start();
    this.logger.info('docker started: ' + this.id);
  }

  async stop() {
    return this.container.stop();
  }

  async remove() {
    await this.container.remove({
      force: true
    });
    try {
      await this.volume.remove({
        force: true
      });
    // deno-lint-ignore no-unused-vars
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (ignoredError) { /* empty */ }
    for (const dir of this.dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async copy(realPath: string, remotePath: string, ignoreGit = false) {
    this.logger.info('docker cp into ' + remotePath);

    const archive = tarFs.pack(realPath, {
      ignore (name) {
        if (name.startsWith(path.join(realPath, '.private'))) {
          return true;
        }
        if (ignoreGit && name.startsWith(path.join(realPath, '.git', 'lfs'))) {
          return true;
        }
        if (ignoreGit && name.startsWith(path.join(realPath, '.git'))) {
          return true;
        }
        if (name.endsWith('.debug.xml')) {
          return true;
        }
        return false;
      },
    });

    await this.container.putArchive(archive, {
      path: remotePath
    });
  }

  async putFile(content: Uint8Array, remotePath: string) {
    const archive = tarStream.pack();
    archive.entry({ name: remotePath }, content);
    archive.finalize();

    const writable = new BufferWritable();
    archive.pipe(writable);

    this.logger.info('docker write into ' + remotePath);

    await this.container.putArchive(writable.getBuffer(), {
      path: '/'
    });
  }

  async export(remotePath: string, outputDir: string) {
    this.logger.info('docker export ' + remotePath);

    const archive = await this.container.getArchive({
      path: remotePath
    });

    await new Promise<void>((resolve, reject) => {
      try {
        const stream = archive.pipe(tarFs.extract(outputDir, {
          map (header) {
            const parts = header.name.split('/');
            parts.shift();
            header.name = parts.join('/');
            return header;
          }
        }));

        stream.on('finish', () => {
          resolve();
        });
        stream.on('error', (err: unknown) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async getFile(remotePath: string): Promise<Uint8Array> {
    const archive = await this.container.getArchive({
      path: remotePath
    });

    return await new Promise<Uint8Array>((resolve, reject) => {
      const retVal: Uint8Array[] = [];
      const extract = tarStream.extract();

      extract.on('entry', (header, stream, next) => {
        stream.on('data', (data: Buffer) => {
          retVal.push(new Uint8Array(data.buffer, data.byteOffset, data.length));
        });
        stream.on('end', () => {
          next();
        });
        stream.resume();
      });

      try {
        const stream = archive.pipe(extract);

        stream.on('finish', () => {
          const totalLength = retVal.reduce((acc, arr) => acc + arr.length, 0);
          const combinedArray = new Uint8Array(totalLength);

          let offset = 0;
          retVal.forEach(arr => {
            combinedArray.set(arr, offset);  // Copy each array into the combined one
            offset += arr.length;  // Update the offset for the next array
          });
          resolve(combinedArray);
        });
        stream.on('error', (err: unknown) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async exec(command: string, env: { [p: string]: string}, writable: Writable) {
    this.logger.info(`docker exec ${this.id} ${command}`);

    const cancelTimeout = new AbortController();

    const exec = await this.container.exec({
      Cmd: command.split(' '),
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: Object.keys(env).map(key => `${key}=${env[key]}`),
      //WorkingDir
      abortSignal: cancelTimeout.signal,
    });

    const stream = await exec.start({});

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    this.container.modem.demuxStream(stream, stdout, stderr);

    stdout.on('data', (chunk: Buffer) => {
      writable.write(chunk);
    });
    stderr.on('data', (chunk: Buffer) => {
      writable.write(chunk);
    });

    await new Promise(resolve => stream.on('end', () => {
      resolve(0);
    }));

    const inspectInfo = await exec.inspect();

    return inspectInfo.ExitCode;
  }

}
