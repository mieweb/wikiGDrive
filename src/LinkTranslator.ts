import { absolutizeUrl, relateUrl } from './utils/RelateUrl.ts';

import {LinkMode} from './model/model.ts';

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

export function convertToRelativeMarkDownPath(localPath: string, basePath: string) {
  if (localPath.startsWith('https://')) return localPath;
  if (localPath.startsWith('http://')) return localPath;
  if (basePath === localPath) return '.';

  const host = '//example.com/';
  return convertExtension(decodeURIComponent(relateUrl(host + basePath, host + localPath)));
}

export function convertToRelativeSvgPath(localPath: string, basePath: string) {
  if (localPath.startsWith('https://')) return localPath;
  if (localPath.startsWith('http://')) return localPath;
  if (basePath === localPath) return '.';

  const host = '//example.com/';
  return convertExtension(decodeURIComponent(relateUrl(host + basePath, host + localPath)), 'dirURLs');
}

export function convertToAbsolutePath(fullPath: string, relativePath: string) {
  if (relativePath.indexOf('://') > -1) {
    return '';
  }
  if (!fullPath.startsWith('/')) {
    fullPath = '/' + fullPath;
  }
  const fakeServer = 'https://example.com';
  const abs = absolutizeUrl(fakeServer + fullPath, relativePath);
  return abs.substring(fakeServer.length);
}
