'use strict';

import RelateUrl from 'relateurl';

import {LinkMode} from './model/model';

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

  const host = '//example.com/';
  return convertExtension(decodeURIComponent(RelateUrl.relate(host + basePath, host + localPath, {
    output: RelateUrl.PATH_RELATIVE
  })), 'dirURLs');
}

export function convertToAbsolutePath(fullPath: string, relativePath: string) {
  if (relativePath.indexOf('://') > -1) {
    return '';
  }
  if (fullPath.startsWith('/')) {
    fullPath = '/' + fullPath;
  }
  const fakeServer = 'https://example.com';
  const abs = RelateUrl.relate(fakeServer + fullPath, relativePath, { output: RelateUrl.ABSOLUTE });
  return abs.substring(fakeServer.length);
}
