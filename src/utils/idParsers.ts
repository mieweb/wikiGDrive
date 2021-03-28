import {GoogleFilesStorage} from '../storage/GoogleFilesStorage';

export function urlToFolderId(url) {
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

  return false;
}

export function argToGoogleFileId(arg: string, googleFiles?: GoogleFilesStorage) {
  let googleFileId = urlToFolderId(arg);

  if (googleFiles) {
    if (!googleFileId) {
      const file = googleFiles.findFile(file => file.id === arg);
      if (file) {
        googleFileId = file.id;
      }
    }

    if (!googleFileId) {
      const file = googleFiles.findFile(file => file.desiredLocalPath === arg);
      if (file) {
        googleFileId = file.id;
      }
    }
  }

  return googleFileId;
}

export function argsToGoogleFileIds(args: string[], googleFiles?: GoogleFilesStorage) {
  if (args.length === 1) { // TODO add more args parsing
    const googleFileId = argToGoogleFileId(args[0], googleFiles);
    if (!googleFileId) {
      throw new Error('Invalid argument: ' + args.join(' '));
    }
    return [googleFileId];
  } else {
    return [];
  }
}
