import path from 'node:path';
import {PassThrough, Writable} from 'node:stream';

import Docker from 'dockerode';
import tarFs from 'tar-fs';
import tarStream from 'tar-stream';
import winston from 'winston';

import {OciContainer} from './OciContainer.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';

export class DockerContainer implements OciContainer {
  public skipMount: false;

  private constructor(private logger: winston.Logger,
                      public readonly id: string,
                      public readonly image: string,
                      private container: Docker.Container,
                      private repoSubDir: string) {
  }

  static async create(logger: winston.Logger, image: string, env: { [p: string]: string }, repoSubDir: string): Promise<OciContainer> {
    const dockerEngine = new Docker({socketPath: '/var/run/docker.sock'});

    const container = await dockerEngine.createContainer({
      Image: image,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
      HostConfig: {
        // Binds: [ // Unlike Mounts those are created if not existing in the host
        //   `${process.env.VOLUME_DATA}/${driveId}_transform:/repo:ro`,
        //   `${process.env.VOLUME_DATA}/${driveIdTransform}:/site:rw`,
        //   `${process.env.VOLUME_DATA}${contentDir}:/site/content:rw`,
        // ],
        Mounts: [
          {
            Source: '',
            Target: '/site/resources',
            Type: 'tmpfs',
            ReadOnly: false,
            TmpfsOptions: {
              SizeBytes: undefined,
              Mode: 0o777
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

    return new DockerContainer(logger, container.id, image, container, repoSubDir);
  }

  async start() {
    await this.container.start();
    this.logger.info('docker started: ' + this.id);

    if (!this.skipMount) {
      await this.copy(this.repoSubDir, '/site');
    }
  }

  async stop() {
    return this.container.stop();
  }

  async copy(realPath: string, remotePath: string, ignoreGit = false) {
    this.logger.info('docker cp into ' + remotePath);

    const archive = tarFs.pack(realPath, {
      ignore (name) {
        if (ignoreGit && name.startsWith(path.join(realPath, '.git'))) {
          return true;
        }
        if (name.startsWith(path.join(realPath, '.private'))) {
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
    this.logger.info('docker export /site/public');

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
