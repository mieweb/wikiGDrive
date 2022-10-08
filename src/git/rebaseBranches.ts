import {Logger} from 'winston';
import NodeGit from 'nodegit';
import {Repository} from 'nodegit/repository';
import {RebaseOptions} from 'nodegit/rebase';
import {wrapError, wrapErrorSync} from './GitScanner';

export async function rebaseBranches(logger: Logger, repo: Repository, branch: string, upstream: string, onto: string,
                                     signature, rebaseOptions?: RebaseOptions) {
  if (!signature) {
    signature = await wrapError(async () => await repo.defaultSignature());
  }

  const branchCommit = await wrapError(async () => await NodeGit.AnnotatedCommit.fromRef(repo, await repo.getReference(branch)));
  const upstreamCommit = upstream ? await wrapError(async () => await NodeGit.AnnotatedCommit.fromRef(repo, await repo.getReference(upstream))) : null;

  const baseOid = await wrapError(async () => await NodeGit.Merge.base(repo, branchCommit.id(), upstreamCommit.id()));

  if (baseOid.toString() === branchCommit.id().toString()) {
    // we just need to fast-forward
    logger.info('git fast-forward');
    await wrapError(async () => await repo.mergeBranches(branch, upstream, null, null));
    // checkout 'branch' to match the behavior of rebase
    logger.info(`git checkout ${branch}`);
    return repo.checkoutBranch(branch);
  } else if (baseOid.toString() === upstreamCommit.id().toString()) {
    // 'branch' is already on top of 'upstream'
    // checkout 'branch' to match the behavior of rebase
    logger.info(`git checkout ${branch}`);
    return repo.checkoutBranch(branch);
  }

  const ontoCommit = onto ? await wrapError(async () => await NodeGit.AnnotatedCommit.fromRef(repo, await repo.getReference(onto))) : null;

  logger.info(`git rebase init, branch: ${branchCommit.id().tostrS()}, upstream: ${upstreamCommit.id().tostrS()}, onto: ${ontoCommit.id().tostrS()}, base: ${baseOid.tostrS()}`);

  const rebase = await wrapError(async () => await NodeGit.Rebase.init(
    repo,
    branchCommit,
    upstreamCommit,
    ontoCommit,
    rebaseOptions
  ));

  try {
    while(await wrapError(async () => await rebase.next())) {
      logger.info('git rebase next');

      const index = await wrapError(async () => await repo.refreshIndex());
      if (index.hasConflicts()) {
        logger.info('git rebase conflict');
        throw new Error('rebase conflict');
      }

      logger.info('git rebase commit');
      await wrapError(async () => await rebase.commit(null, signature, 'utf-8', null));
    }
  } catch (error) {
    if (error && error.errno === NodeGit.Error.CODE.ITEROVER) {
      wrapErrorSync(() => rebase.finish(signature));
      logger.info('git rebase finished');
    } else {
      wrapErrorSync(() => rebase.abort());
      logger.error('git rebase aborted');
      throw error;
    }
  }

  return repo.getBranchCommit('HEAD');
}
