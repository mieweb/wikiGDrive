import {GitScanner} from './GitScanner.ts';
import {sanitize} from './GitExecuter.ts';

export class GitStash {
  constructor(private readonly gitScanner: GitScanner) {
  }

  get debug() {
    return this.gitScanner.debug;
  }

  private async getCount(): Promise<number> {
    const result = await this.gitScanner.executer.exec('git stash list --format=%gd', { skipLogger: !this.debug });
    const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);
    return lines.length;
  }

  async stash(message: string): Promise<boolean> {
    const beforeCount = await this.getCount();

    try {
      await this.gitScanner.executer.exec(`git stash push -u -m "${sanitize(message)}"`, {
        skipLogger: !this.debug
      });
    } catch (err: any) {
      if (err.message && err.message.includes('No local changes to save')) {
        return false;
      }
      throw err;
    }

    const afterCount = await this.getCount();
    return afterCount > beforeCount;
  }

  async pop(): Promise<void> {
    try {
      await this.gitScanner.executer.exec('git stash pop', { skipLogger: !this.debug });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('No stash entries found')) {
        return;
      }

      if (message.includes('CONFLICT')) {
        throw new Error('Stash pop encountered merge conflicts. Please resolve conflicts manually.');
      }
      throw err;
    }
  }

  async drop(stashNo = 0) {
    await this.gitScanner.executer.exec(`git stash drop stash@{${stashNo}`, { skipLogger: !this.debug });
  }

  async apply(stashNo = 0) {
    await this.gitScanner.executer.exec(`git stash apply stash@{${stashNo}`, { skipLogger: !this.debug });
  }

}
