import slugify from 'slugify';
import {BinaryFile, DrawingFile, Directory, LocalFile, MdFile, ShortcutFile} from '../../model/LocalFile';
import { GoogleFile, MimeTypes } from '../../model/GoogleFile';
import {googleMimeToExt} from './TaskLocalFileTransform';

const MAX_PATH_LENGTH = 2000;
const MAX_FILENAME_LENGTH = 200;

export function getDesiredPath(name: string, mimeType?: string) {
  name = name.replace(/[&]+/g, ' and ');
  name = name.replace(/[/,:()]+/g, ' ');
  name = name.trim();
  name = slugify(name, { replacement: '-', lower: true, remove: /[#*+~()'"!:@]/g });

  if (mimeType) {
    const ext = googleMimeToExt(mimeType, name);
    switch (mimeType) {
      case MimeTypes.DOCUMENT_MIME:
        name += '.md';
        break;
      case MimeTypes.DRAWING_MIME:
        name += '.svg';
        break;
      case MimeTypes.FOLDER_MIME:
        break;
      default:
        if (name.indexOf('.') === -1) {
          name += '.' + ext;
        }
    }
  }

  return name.substring(0, MAX_FILENAME_LENGTH);
}

export class LocalFilesGenerator {
  async generateLocalFiles(googleFiles: GoogleFile[]): Promise<LocalFile[]> {
    const retVal: LocalFile[] = [];

    for (const googleFile of googleFiles) {
      const desiredLocalPath = getDesiredPath(googleFile.name, googleFile.mimeType).substring(0, MAX_PATH_LENGTH);
      switch (googleFile.mimeType) {
        case MimeTypes.FOLDER_MIME:
          {
            const folder: Directory = {
              type: 'directory',
              id: googleFile.id,
              title: googleFile.name,
              modifiedTime: googleFile.modifiedTime,
              version: +googleFile.version,
              mimeType: googleFile.mimeType,
              fileName: desiredLocalPath,
            };
            retVal.push(folder);
          }
          break;
        case MimeTypes.DOCUMENT_MIME:
          {
            const mdFile: MdFile = {
              type: 'md',
              id: googleFile.id,
              title: googleFile.name,
              modifiedTime: googleFile.modifiedTime,
              version: +googleFile.version,
              mimeType: 'text/x-markdown',
              lastAuthor: googleFile.lastAuthor,
              fileName: desiredLocalPath,
            };
            retVal.push(mdFile);
          }
          break;
        case MimeTypes.DRAWING_MIME:
          {
            const drawingFile: DrawingFile = {
              type: 'drawing',
              id: googleFile.id,
              title: googleFile.name,
              modifiedTime: googleFile.modifiedTime,
              version: +googleFile.version,
              mimeType: 'image/svg+xml',
              fileName: desiredLocalPath,
            };
            retVal.push(drawingFile);
          }
          break;
        case MimeTypes.SHORTCUT:
          {
            const shortcutFile: ShortcutFile = {
              type: 'shortcut',
              id: googleFile.id,
              title: googleFile.name,
              modifiedTime: googleFile.modifiedTime,
              version: +googleFile.version,
              mimeType: MimeTypes.SHORTCUT,
              fileName: desiredLocalPath,
            };
            retVal.push(shortcutFile);
          }
          break;
        default:
          {
            const binaryFile: BinaryFile = {
              type: 'binary',
              id: googleFile.id,
              title: googleFile.name,
              modifiedTime: googleFile.modifiedTime,
              version: +googleFile.version,
              mimeType: googleFile.mimeType,
              fileName: desiredLocalPath,
            };
            retVal.push(binaryFile);
          }
          break;
      }
    }
    return retVal;
  }
}
