'use strict';

import path from 'path';
import fs from 'fs';
import RelateUrl from 'relateurl';

export class LinkTranslator {

  constructor(filesStructure, httpClient, binaryFiles, dest) {
    this.fileMap = filesStructure.getFileMap();
    this.httpClient = httpClient;
    this.binaryFiles = binaryFiles;
    this.dest = dest;
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
        url = file.htmlPath || file.localPath;

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
      const md5 = await this.httpClient.md5Url(url);

      if (md5) {
        for (let fileId in this.fileMap) {
          const file = this.fileMap[fileId];

          if (file.md5Checksum === md5) {
            return file.localPath;
          }
        }

        if (this.binaryFiles[md5]) {
          return this.binaryFiles[md5].localDocumentPath || this.binaryFiles[md5].localPath;
        }

        const localPath = path.join('external_files', md5 + '.png');
        const targetPath = path.join(this.dest, localPath);
        const writeStream = fs.createWriteStream(targetPath);

        await this.httpClient.downloadUrl(url, writeStream);

        this.binaryFiles[md5] = {
          localPath: localPath,
          md5checksum: md5
        };

        return localPath;
      }
    }

    return url;
  }

  convertToRelativePath(localPath, basePath) {
    if (basePath == localPath) return '.';

    const host = '//example.com/';
    return decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
        output: RelateUrl.PATH_RELATIVE
    }));
  }

}
