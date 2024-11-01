import Docker from 'dockerode';
import path from 'path';
import tarFs from 'tar-fs';
import tarStream from 'tar-stream';
import {PassThrough, Writable} from 'stream';
import winston from 'winston';
import {OciContainer} from './OciContainer.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';

export class PodmanContainer implements OciContainer {
  public skipMount: false;

  private constructor(private logger: winston.Logger, public readonly id: string, public readonly image: string, private container: Docker.Container) {
  }

  static async create(logger: winston.Logger, image: string, env: { [p: string]: string }, repoSubDir: string): Promise<OciContainer> {
    const podmanEngine = new Docker({socketPath: '/var/run/podman/podman.sock'});

    const container = await podmanEngine.createContainer({
      Image: image,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,

      HostConfig: {
        Binds: [ // Unlike Mounts those are created if not existing in the host
          `${process.env.VOLUME_DATA}/${repoSubDir}:/site:O`,
        ],
      },
      Env: Object.keys(env).map(key => `${key}=${env[key]}`),
      User: String(process.getuid())+ ':' + String(process.getegid())
    });

    return new PodmanContainer(logger, container.id, image, container);
  }

  async start() {
    await this.container.start();
    this.logger.info('podman started: ' + this.id);
  }

  async stop() {
    return this.container.stop();
  }

  async copy(realPath: string, remotePath: string, ignoreGit = false) {
    this.logger.info('podman copy into ' + remotePath);

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

  async putFile(configToml: Uint8Array, remotePath: string) {
    const archive = tarStream.pack();
    archive.entry({ name: remotePath }, configToml);
    archive.finalize();

    const writable = new BufferWritable();
    archive.pipe(writable);

    this.logger.info('podman write into ' + remotePath);

    await this.container.putArchive(writable.getBuffer(), {
      path: '/'
    });
  }

  async export(remotePath: string, outputDir: string) {
    this.logger.info('podman export /site/public');

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
    this.logger.info(`podman exec ${this.id} ${command}`);

    const cancelTimeout = new AbortController();

    const exec = await this.container.exec({
      Cmd: command.split(' '),
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Env: Object.keys(env).map(key => `${key}=${env[key]}`),
      //WorkingDir
      abortSignal: cancelTimeout.signal,
    });

    const stream = await exec.start({hijack: true, Detach: false});

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
