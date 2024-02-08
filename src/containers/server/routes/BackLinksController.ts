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

    const linkFileIds = localLinks.getLinks(fileId);
    const links = [];
    for (const linkFileId of linkFileIds) {
      const [file] = await markdownTreeProcessor.findById(linkFileId);
      if (file) {
        links.push({
          folderId: file.parentId,
          fileId: linkFileId,
          path: file.path,
          name: file.fileName
        });
      }
    }

    const backLinkFileIds = localLinks.getBackLinks(fileId);
    const backlinks = [];
    for (const backLinkFileId of backLinkFileIds) {
      const [file] = await markdownTreeProcessor.findById(backLinkFileId);
      if (file) {
        backlinks.push({
          folderId: file.parentId,
          fileId: backLinkFileId,
          path: file.path,
          name: file.fileName
        });
      }
    }

    return { backlinks, links };
  }

}
