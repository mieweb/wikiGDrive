import lunr from 'lunr';

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

    const lunrData = await transformedFileSystem.readJson('/.private/lunr.json');
    if (!lunrData?.index) {
      return [];
    }

    const store = lunrData.store || {};
    const lunrIndex = lunr.Index.load(lunrData.index);

    queryParam = (queryParam || '').trim().replace(/:/g, ' ');

    let result = lunrIndex.search(queryParam);
    if (result.length === 0 && queryParam.indexOf('*') === -1) {
      result = lunrIndex.search(queryParam.split(/\s+/g).map(w => w.length > 2 ? w + '*' : w).join(' '));
    }
    if (result.length === 0 && queryParam.replace(/[_-]*/g, '').length > 10) {
      result = lunrIndex.search(queryParam.replace(/[_-]*/g, ''));
    }

    return { result: result.map((doc) => ({
      path: prefix + doc.ref,
      score: doc.score,
      matchData: doc.matchData,
      ...store[doc.ref]
    })) };
  }
}
