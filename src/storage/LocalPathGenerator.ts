import slugify from 'slugify';
import {GoogleFile, GoogleFilesStorage} from './GoogleFilesStorage';
import {LocalFile} from './LocalFilesStorage';

const MAX_PATH_LENGTH = 2000;
const MAX_FILENAME_LENGTH = 200;

export function getDesiredPath(name) {
  name = name.replace(/[&]+/g, ' and ');
  name = name.replace(/[/:()]+/g, ' ');
  name = name.trim();
  name = slugify(name, {replacement: '-', lower: true});
  return name.substr(0, MAX_FILENAME_LENGTH);
}

export class LocalPathGenerator {

  constructor(private flat_folder_structure: boolean) {
  }

  generateLevelFiles(parentId: string, googleFiles: GoogleFile[], prefix = '') {
    if (this.flat_folder_structure) {
      prefix = '';
    }

    const levelFiles: LocalFile[] = googleFiles.filter(file => file.parentId === parentId)
      .map(googleFile => {
        const desiredLocalPath = (prefix + '/' + getDesiredPath(googleFile.name)).substr(0, MAX_PATH_LENGTH);
        return {
          id: googleFile.id,
          modifiedTime: googleFile.modifiedTime,
          mimeType: googleFile.mimeType,
          desiredLocalPath
        };
      });

    for (const levelFile of levelFiles) {
      const subLevelFiles = this.generateLevelFiles(levelFile.id, googleFiles, levelFile.desiredLocalPath);
      levelFiles.push(...subLevelFiles);
    }

    return levelFiles;
  }

  async generateDesiredPaths(rootId: string, googleFiles: GoogleFile[]) {
    const retVal: LocalFile[] = this.generateLevelFiles(rootId, googleFiles);

    const externalFiles: GoogleFile[] = googleFiles.filter(googleFile => !retVal.find(localFile => localFile.id === googleFile.id));

    retVal.push(...externalFiles.map(googleFile => {
      const desiredLocalPath = 'external_docs/' + googleFile.parentId + '/' + getDesiredPath(googleFile.name);
      return {
        id: googleFile.id,
        modifiedTime: googleFile.modifiedTime,
        mimeType: googleFile.mimeType,
        desiredLocalPath
      };
    }));

    return retVal;
  }

}
