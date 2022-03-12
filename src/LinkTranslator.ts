'use strict';

import * as RelateUrl from 'relateurl';

import {LinkMode} from './model/model';
import {DirectoryScanner} from './containers/transform/DirectoryScanner';

export function convertExtension(localPath: string, mode?: LinkMode) {
  const lastSlash = localPath.lastIndexOf('/');

  const dirName = localPath.substring(0, lastSlash + 1);
  const fileName = localPath.substring(lastSlash + 1);

  const parts = fileName.split('.');

  if (parts.length > 1) {
    const ext = parts[parts.length - 1];

    switch (ext) {
      case 'md':

        switch (mode) {
          case 'uglyURLs':
            parts[parts.length - 1] = 'html';
            break;

          case 'dirURLs':
            parts.pop();
            break;

          case 'mdURLs':
          default:
            parts[parts.length - 1] = 'md';
            break;
        }

        break;
    }
  }

  return dirName + parts.join('.');
}

export function convertToRelativeMarkDownPath(localPath, basePath) {
  if (localPath.startsWith('https://')) return localPath;
  if (localPath.startsWith('http://')) return localPath;
  if (basePath === localPath) return '.';

  const host = '//example.com/';
  return convertExtension(decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
    output: RelateUrl.PATH_RELATIVE
  })));
}

export function convertToRelativeSvgPath(localPath, basePath) {
  if (localPath.startsWith('https://')) return localPath;
  if (localPath.startsWith('http://')) return localPath;
  if (basePath === localPath) return '.';

  localPath = convertExtension(localPath);

  const host = '//example.com/';
  return convertExtension(decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
    output: RelateUrl.PATH_RELATIVE
  })), 'dirURLs');
}


export class LinkTranslator {
  private mode: LinkMode;

  constructor(private generatedScanner: DirectoryScanner) {
    /*
     * uglyURLs - https://gohugo.io/getting-started/configuration/
     *
     */
    this.mode = 'uglyURLs';
  }

  setMode(mode: LinkMode) {
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

/*
  async urlToDestUrl(url: string) {
    const generatedFiles = this.generatedScanner.getFiles();
    const file = generatedFiles.find(file => url.indexOf(file.id) > -1);
    if (file && file.localPath) {
      return file.localPath;
      // if (file.mimeType === MimeTypes.FOLDER_MIME) {
        // url += '/';
      // }
    }

    return url;
  }

*/
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



}
