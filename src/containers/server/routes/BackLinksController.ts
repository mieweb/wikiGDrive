import {Controller, RouteGet, RouteParamPath} from './Controller.ts';
import {FileContentService} from '../../../utils/FileContentService.ts';
import {LocalLinks} from '../../transform/LocalLinks.ts';
import {UserConfigService} from '../../google_folder/UserConfigService.ts';
import {MarkdownTreeProcessor} from '../../transform/MarkdownTreeProcessor.ts';
import {getContentFileService} from '../../transform/utils.ts';

export class BackLinksController extends Controller {

  constructor(subPath: string, private readonly filesService: FileContentService) {
    super(subPath);
  }

  @RouteGet('/:driveId/:fileId')
  async getBackLinks(@RouteParamPath('driveId') driveId: string, @RouteParamPath('fileId') fileId: string) {
    const googleFileSystem = await this.filesService.getSubFileService(driveId, '/');
    const userConfigService = new UserConfigService(googleFileSystem);
    await userConfigService.load();
    const transformedFileSystem = await this.filesService.getSubFileService(driveId + '_transform', '');
    const contentFileService = await getContentFileService(transformedFileSystem, userConfigService);

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.load();

    const localLinks = new LocalLinks(contentFileService);
    await localLinks.load();

    const linksArr = localLinks.getLinks(fileId);
    if (linksArr === false) {
      return { backlinks: [], links: [], notGenerated: true };
    }

    const links = [];
    for (const linkObj of linksArr) {
      const { fileId, linksCount } = linkObj;
      const [file] = await markdownTreeProcessor.findById(fileId);
      if (file) {
        links.push({
          folderId: file.parentId,
          fileId: fileId,
          linksCount,
          path: file.path,
          name: file.fileName
        });
      }
    }

    const backLinkFileIds = localLinks.getBackLinks(fileId);
    const backlinks = [];
    for (const backLinkObj of backLinkFileIds) {
      const { fileId, linksCount } = backLinkObj;
      const [file] = await markdownTreeProcessor.findById(fileId);
      if (file) {
        backlinks.push({
          folderId: file.parentId,
          fileId: fileId,
          linksCount,
          path: file.path,
          name: file.fileName
        });
      }
    }

    return { backlinks, links };
  }

}
