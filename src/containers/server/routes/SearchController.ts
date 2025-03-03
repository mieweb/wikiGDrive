import {
  Controller,
  RouteErrorHandler,
  RouteGet,
  RouteParamPath,
  RouteParamQuery
} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {ShareErrorHandler} from './FolderController.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {createIndexer} from '../../search/Indexer.ts';

export class SearchController extends Controller {
  constructor(subPath: string, private filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  @RouteErrorHandler(new ShareErrorHandler())
  async search(@RouteParamPath('driveId') driveId: string, @RouteParamQuery('q') queryParam: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    const prefix = (userConfigService.config.transform_subdir || '').startsWith('/') ? `${userConfigService.config.transform_subdir}` : '';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const indexer = await createIndexer();
    await indexer.setData(await transformedFileSystem.readBuffer('/.private/' + indexer.getFileName()));

    const retVal = await indexer.search(queryParam);

    retVal.result = retVal.result.map(a => ({
      ...a,
      path: prefix + a.path
    }));

    return retVal;
  }
}
