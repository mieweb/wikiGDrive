import lunr from 'lunr';

import {
  Controller,
  RouteErrorHandler,
  RouteGet,
  RouteParamPath,
  RouteParamQuery
} from './Controller';
import {FileContentService} from '../../../utils/FileContentService';
import {ShareErrorHandler} from './FolderController';
import {UserConfigService} from '../../google_folder/UserConfigService';

export class SearchController extends Controller {
  constructor(subPath: string, private filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId')
  @RouteErrorHandler(new ShareErrorHandler())
  async search(@RouteParamPath('driveId') driveId: string, @RouteParamQuery('q') query: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();

    const prefix = userConfigService.config.transform_subdir ? `/${userConfigService.config.transform_subdir}` : '';

    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');

    const lunrData = await transformedFileSystem.readJson('/.private/lunr.json');
    if (!lunrData?.index) {
      return [];
    }

    const store = lunrData.store || {};
    const lunrIndex = lunr.Index.load(lunrData.index);

    query = (query || '').trim().replace(/:/g, ' ');

    let result = lunrIndex.search(query);
    if (result.length === 0 && query.indexOf('*') === -1) {
      result = lunrIndex.search(query + '*');
    }

    return { result: result.map((doc) => ({
      path: prefix + doc.ref,
      score: doc.score,
      matchData: doc.matchData,
      ...store[doc.ref]
    })) };
  }
}
