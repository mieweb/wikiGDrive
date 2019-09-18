'use strict';

import path from 'path';
import fs from 'fs';

export class LinkTranslator {

  constructor(fileMap, httpClient, binaryFiles, dest) {
    this.fileMap = fileMap;
    this.httpClient = httpClient;
    this.binaryFiles = binaryFiles;
    this.dest = dest;
  }

  async imageUrlToLocalPath(url) {
    for (let fileId in this.fileMap) {
      const file = this.fileMap[fileId];

      if (url.indexOf(fileId) > -1) {
        url = '/' + file.localPath;
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

        const targetPath = path.join(this.dest, '.binary_files', md5 + '.png');
        const writeStream = fs.createWriteStream(targetPath);

        await this.httpClient.downloadUrl(url, writeStream);

        this.binaryFiles[md5] = {
          localPath: targetPath,
          md5checksum: md5
        };

        return targetPath;
      }
    }

    return url;
  }

}
