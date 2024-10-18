import Docker from 'dockerode';
import path from 'path';
import tarFs from 'tar-fs';
import tarStream from 'tar-stream';
import {PassThrough, Writable} from 'stream';

export class DockerContainer {
  public id: string;
  private docker: Docker;
  private container: Docker.Container;
  private writable: Writable;
  constructor(private image: string) {
    this.docker = new Docker({socketPath: '/var/run/docker.sock'});
  }

  async create(env: { [p: string]: string }, writable: Writable) {
    this.writable = writable;
    this.container = await this.docker.createContainer({
      Image: process.env.ACTION_IMAGE,
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
    this.id = this.container.id;
  }

  async start() {
    return this.container.start();
  }

  async stop() {
    return this.container.stop();
  }

  async copy(realPath: string, remotePath: string, ignoreGit = false) {
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
    await this.container.putArchive(archive, {
      path: '/'
    });
  }

  async export(remotePath: string, outputDir: string) {
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

  async exec(command: string, env: { [p: string]: string}) {
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
      this.writable.write(chunk);
    });

    await new Promise(resolve => stream.on('end', () => {
      resolve(0);
    }));

    const inspectInfo = await exec.inspect();

    return inspectInfo.ExitCode;
  }

}
