'use strict';

import * as RelateUrl from 'relateurl';

import {LinkMode} from './MainService';
import {LocalFilesStorage} from './storage/LocalFilesStorage';

export class LinkTranslator {
  private mode: LinkMode;

  constructor(private localFilesStorage: LocalFilesStorage) {
    /*
     * uglyURLs - https://gohugo.io/getting-started/configuration/
     *
     */
    this.mode = LinkMode.uglyURLs;
  }

  setMode(mode = this.mode) {
    this.mode = mode;
  }

  async urlToLocalPath(url) {
/*
    for (const fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = file.localPath;
        return url;
      }
    }
*/
  }

  async urlToDestUrl(url) {
    const file = this.localFilesStorage.findFile(file => url.indexOf(file.id) > -1);
    if (file && file.localPath) {
      return file.localPath;
      // if (file.mimeType === MimeTypes.FOLDER_MIME) {
        // url += '/';
      // }
    }

    return url;
  }

  /*async imageUrlToLocalPath(url) {
    return url;
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1 && url.indexOf('parent=' + fileId) === -1) {
        url = file.localPath;
        return url;
      }
    }

    if (url.startsWith('https:') || url.startsWith('http:')) {
      const tempPath = await this.externalFiles.downloadTemp(url, path.join(this.externalFiles.getDest(), 'external_files'));
      const fileService = new FileService();
      const md5 = await fileService.md5File(tempPath);

      if (md5) {
        const file = this.googleFiles.findFile(file => file.md5Checksum === md5);
        if (file) {
          return file.localPath;
        }

        const externalFile = this.externalFiles.findFile(file => file.md5Checksum === md5);
        if (externalFile) {
          return externalFile.localDocumentPath || externalFile.localPath;
        }
      }
    }

    return url;
  }*/

  convertExtension(localPath: string, mode?: LinkMode) {
    if (!mode) mode = this.mode;
    const lastSlash = localPath.lastIndexOf('/');

    const dirName = localPath.substr(0, lastSlash + 1);
    const fileName = localPath.substr(lastSlash + 1);

    const parts = fileName.split('.');

    if (parts.length > 1) {
      const ext = parts[parts.length - 1];

      switch (ext) {
      case 'md':

        switch (mode) {
        case LinkMode.uglyURLs:
          parts[parts.length - 1] = 'html';
          break;

        case LinkMode.dirURLs:
          parts.pop();
          break;

        case LinkMode.mdURLs:
        default:
          parts[parts.length - 1] = 'md';
          break;
        }

        break;
      }
    }

    return dirName + parts.join('.');
  }

  convertToRelativeMarkDownPath(localPath, basePath) {
    if (localPath.startsWith('https://')) return localPath;
    if (localPath.startsWith('http://')) return localPath;
    if (basePath === localPath) return '.';

    const host = '//example.com/';
    return this.convertExtension(decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
      output: RelateUrl.PATH_RELATIVE
    })));
  }

  convertToRelativeSvgPath(localPath, basePath) {
    if (localPath.startsWith('https://')) return localPath;
    if (localPath.startsWith('http://')) return localPath;
    if (basePath === localPath) return '.';

    localPath = this.convertExtension(localPath);

    const host = '//example.com/';
    return this.convertExtension(decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
      output: RelateUrl.PATH_RELATIVE
    })), LinkMode.dirURLs);
  }

}
