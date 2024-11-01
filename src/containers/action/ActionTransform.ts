import {FileId} from '../../model/model.ts';
import {TransformContainer} from '../transform/TransformContainer.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {getContentFileService} from '../transform/utils.ts';
import {MarkdownTreeProcessor} from '../transform/MarkdownTreeProcessor.ts';
import {ContainerEngine} from '../../ContainerEngine.ts';
import {clearCachedChanges, JobManagerContainer} from '../job/JobManagerContainer.ts';
import {FileContentService} from '../../utils/FileContentService.ts';

export class ActionTransform {

  constructor(private engine: ContainerEngine, private googleFileSystem: FileContentService, private transformedFileSystem: FileContentService) {
  }

  async execute(folderId: FileId, jobId: string, filesIds: FileId[] = []) {
    const transformContainer = new TransformContainer({
      folderId,
      name: jobId,
      jobId
    }, { filesIds });
    await transformContainer.mount2(
      this.googleFileSystem,
      this.transformedFileSystem
    );

    const userConfigService = new UserConfigService(this.googleFileSystem);
    await userConfigService.load();

    transformContainer.setUseGoogleMarkdowns(userConfigService.config.use_google_markdowns);

    const jobManager = <JobManagerContainer>this.engine.getContainer('job_manager');
    transformContainer.onProgressNotify(({ completed, total, warnings, failed }) => {
      jobManager.progressJob(folderId, jobId, { completed, total, warnings, failed });
    });

    await this.engine.registerContainer(transformContainer);
    try {
      await transformContainer.run(folderId);
      if (transformContainer.failed()) {
        throw new Error('Transform failed');
      }

      const contentFileService = await getContentFileService(this.transformedFileSystem, userConfigService);
      const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
      await markdownTreeProcessor.load();

    } finally {
      await this.engine.unregisterContainer(transformContainer.params.name);
    }

    await clearCachedChanges(this.googleFileSystem);
  }

}
