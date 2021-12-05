import {GoogleFilesStorage} from '../storage/GoogleFilesStorage';
import {LocalFilesStorage} from '../storage/LocalFilesStorage';

export function urlToFolderId(url: string): string {
  if (url.match(/drive\.google\.com\/drive.*folders\//)) {
    let id = url.substr(url.indexOf('/folders/') + '/folders/'.length);
    if (id.indexOf('/') > 0) {
      id = id.substr(0, id.indexOf('/'));
    }
    if (id.indexOf('?') > 0) {
      id = id.substr(0, id.indexOf('?'));
    }
    if (id.indexOf('&') > 0) {
      id = id.substr(0, id.indexOf('&'));
    }
    return id;
  }

  if (url.indexOf('https://drive.google.com/open?id%3D') > -1) {
    url = url.replace('https://drive.google.com/open?id%3D', 'https://drive.google.com/open?id=');
  }

  if (url.indexOf('https://drive.google.com/open?id=') > -1) {
    let id = url.substr(url.indexOf('https://drive.google.com/open?id=') + 'https://drive.google.com/open?id='.length);
    if (id.indexOf('&') > 0) {
      id = id.substr(0, id.indexOf('&'));
    }
    return id;
  }

  if (url.startsWith('https://docs.google.com/drawings/d/')) {
    let id = url.substr(url.indexOf('docs.google.com/drawings/d/') + 'docs.google.com/drawings/d/'.length);
    if (id.indexOf('/') > 0) {
      id = id.substr(0, id.indexOf('/'));
    }
    if (id.indexOf('?') > 0) {
      id = id.substr(0, id.indexOf('?'));
    }
    if (id.indexOf('&') > 0) {
      id = id.substr(0, id.indexOf('&'));
    }
    return id;
  }

  if (url.indexOf('docs.google.com/document/d/') > 0) {
    let id = url.substr(url.indexOf('docs.google.com/document/d/') + 'docs.google.com/document/d/'.length);
    if (id.indexOf('/') > 0) {
      id = id.substr(0, id.indexOf('/'));
    }
    if (id.indexOf('?') > 0) {
      id = id.substr(0, id.indexOf('?'));
    }
    if (id.indexOf('&') > 0) {
      id = id.substr(0, id.indexOf('&'));
    }
    return id;
  }

  if (url.match(/^[A-Z0-9_]+$/ig)) {
    return url;
  }

  return null;
}

export function argToGoogleFileId(arg: string, googleFilesStorage: GoogleFilesStorage, localFilesStorage: LocalFilesStorage): string[] {
  const googleFileId = urlToFolderId(arg);

  if (!googleFileId) {
    const files = googleFilesStorage.findFiles(file => file.id === arg);
    if (files.length > 0) {
      return files.map(f => f.id);
    }
  }

  if (!googleFileId) {
    const files = localFilesStorage.findFiles(file => file.desiredLocalPath === arg);
    if (files.length > 0) {
      return files.map(f => f.id);
    }
  }

  return [googleFileId];
}

export function argsToGoogleFileIds(args: string[], googleFilesStorage: GoogleFilesStorage, localFilesStorage: LocalFilesStorage) {
  if (args.length === 1) { // TODO add more args parsing
    const googleFileIds: string[] = argToGoogleFileId(args[0], googleFilesStorage, localFilesStorage);
    if (googleFileIds.length === 0) {
      throw new Error('Invalid argument: ' + args.join(' '));
    }
    return [].concat(googleFileIds);
  } else {
    return [];
  }
}
