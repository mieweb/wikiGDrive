import {FileContentService} from '../../utils/FileContentService';
import {GoogleFile} from '../../model/GoogleFile';

export class GoogleFilesScanner {
  async scan(googleFolder: FileContentService): Promise<GoogleFile[]> {
    return await googleFolder.readJson('.folder-files.json') || [];
  }
}
