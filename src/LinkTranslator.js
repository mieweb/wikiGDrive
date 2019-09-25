'use strict';

import path from 'path';
import RelateUrl from 'relateurl';

export class LinkTranslator {

  constructor(filesStructure, externalFiles) {
    this.filesStructure = filesStructure;
    this.fileMap = filesStructure.getFileMap();
    this.externalFiles = externalFiles;
  }

  async urlToLocalPath(url) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = file.localPath;
        return url;
      }
    }
  }

  async urlToDestUrl(url) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = file.localPath;

        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // url += '/';
        }

        return url;
      }
    }

    return url;
  }

  async imageUrlToLocalPath(url) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = file.localPath;
        return url;
      }
    }

    if (url.startsWith('https:') || url.startsWith('http:')) {
      const md5 = await this.externalFiles.getMd5(url);

      if (md5) {
        const file = this.filesStructure.findFile(file => file.md5Checksum === md5);
        if (file) {
          return file.localPath;
        }

        const externalFile = this.externalFiles.findFile(file => file.md5Checksum === md5);
        if (externalFile) {
          return externalFile.localDocumentPath || externalFile.localPath;
        }

        const localPath = path.join('external_files', md5 + '.png');
        return await this.externalFiles.download(url, localPath);
      }

    }

    return url;
  }

  convertToRelativePath(localPath, basePath) {
    if (basePath === localPath) return '.';

    const host = '//example.com/';
    return decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
        output: RelateUrl.PATH_RELATIVE
    }));
  }

}
