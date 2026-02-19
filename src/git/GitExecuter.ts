import process from 'node:process';

import { Logger } from 'winston';
import { GitScanner } from './GitScanner.ts';

const __filename = import.meta.filename;

export interface SshParams {
  privateKeyFile: string;
}

export function sanitize(txt: string) {
  txt = txt.replace(/[;"|]/g, '');
  return txt;
}

interface ExecOpts {
  env?: {
    [k: string]: string
  };
  skipLogger?: boolean;
  ignoreError?: boolean;
}

export class GitExecuter {
  public readonly rootPath: string;
  private logger: Logger;

  constructor(private readonly gitScanner: GitScanner) {
    this.logger = gitScanner.logger;
    this.rootPath = gitScanner.rootPath;
  }

  public sshOptsEnv(sshParams?: SshParams): Record<string, string> {
    return {
      GIT_SSH_COMMAND: sshParams?.privateKeyFile ? `ssh -i ${sanitize(sshParams.privateKeyFile)} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes` : ''
    }
  }

  public committerEnv(committer: { name: string; email: string; }): Record<string, string> {
    return {
      GIT_AUTHOR_NAME: committer.name,
      GIT_AUTHOR_EMAIL: committer.email,
      GIT_COMMITTER_NAME: committer.name,
      GIT_COMMITTER_EMAIL: committer.email,
    }
  }

  public async exec(cmd: string, opts: ExecOpts = { env: {}, skipLogger: false, ignoreError: false }): Promise<{ stdout: string, stderr: string }> {
    if (!opts.skipLogger) {
      this.logger.info(cmd, { stackOffset: 1, filename: __filename });
    }

    let [ stdout, stderr ] = [ '', '' ];

    if (!opts.env) {
      opts.env = {};
    }
    if (!opts.env['HOME']) {
      opts.env['HOME'] = process.env.HOME;
    }
    if (!opts.env['PATH']) {
      opts.env['PATH'] = process.env.PATH;
    }

    const command = new Deno.Command('/bin/sh', {
      args: [ '-c', cmd ],
      cwd: this.rootPath,
      env: opts.env,
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = command.spawn();

    const timer = setTimeout(() => {
      this.logger.error('Process timeout', { filename: __filename });
      child.kill();
    }, 300_000);

    const decoder = new TextDecoder();

    const [status] = await Promise.all([
      child.status,
      child.stdout.pipeTo(new WritableStream({
        write: (chunk, controller) => {
          const text = decoder.decode(chunk);
          stdout += text;
          if (!opts.skipLogger) {
            this.logger.info(text, { filename: __filename });
          }
        }
      })),
      child.stderr.pipeTo(new WritableStream({
        write: (chunk, controller) => {
          const text = decoder.decode(chunk);
          stderr += text;
          if (!opts.skipLogger) {
            this.logger.error(text, { filename: __filename });
          }
        }
      }))
    ]);

    clearTimeout(timer);

    if (!status.success && !opts.ignoreError) {
      this.logger.error('Process exited with status: ' + status.code, { filename: __filename });
      throw new Error('Process exited with status: ' + status.code + '\n' + stderr);
    }

    return { stdout, stderr };
  }

  async cmd(cmd: string, arg: string = '') {
    if (!['status', 'remote -v', 'ls-files --stage', 'branch -m'].includes(cmd)) {
      throw new Error('Forbidden command');
    }

    const result = await this.exec('git ' + cmd + ' ' + (arg || ''), { skipLogger: !this.gitScanner.debug });

    return { stdout: result.stdout, stderr: result.stderr };
  }

}
