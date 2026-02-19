import {GitScanner} from './GitScanner.ts';
import {GitExecuter, SshParams} from './GitExecuter.ts';

export class GitReset {
  private executer: GitExecuter;
  constructor(private readonly gitScanner: GitScanner) {
    this.executer = gitScanner.executer;
  }

  get debug() {
    return this.gitScanner.debug;
  }

  async resetToLocal(sshParams?: SshParams) {
    await this.executer.exec('git checkout main --force', {});
    try {
      await this.executer.exec('git rebase --abort', { ignoreError: true });
    } catch (ignoredError) { /* empty */ }

    await this.gitScanner.executer.exec('git reset --hard HEAD', { env: { ...this.executer.sshOptsEnv(sshParams) }});

    await this.gitScanner.removeUntracked();
  }

  async resetToRemote(remoteBranch: string, sshParams?: SshParams) {
    if (!remoteBranch) {
      remoteBranch = 'main';
    }

    await this.executer.exec(`git fetch origin ${remoteBranch}`, { env: { ...this.executer.sshOptsEnv(sshParams) }});

    try {
      await this.executer.exec('git rebase --abort', { ignoreError: true });
    } catch (ignoredError) { /* empty */ }

    await this.executer.exec(`git reset --hard origin/${remoteBranch}`, { env: { ...this.executer.sshOptsEnv(sshParams) }});
    await this.gitScanner.removeUntracked();
  }
}
