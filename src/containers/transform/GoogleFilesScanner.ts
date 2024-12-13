import {FileContentService} from '../../utils/FileContentService.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';

export class GoogleFilesScanner {
  async scan(googleFolder: FileContentService): Promise<GoogleFile[]> {
    return await googleFolder.readJson('.folder-files.json') || [];
  }
}
