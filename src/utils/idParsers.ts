function stripUrlSuffix(id) {
  if (id.indexOf('/') > 0) {
    id = id.substring(0, id.indexOf('/'));
  }
  if (id.indexOf('?') > 0) {
    id = id.substring(0, id.indexOf('?'));
  }
  if (id.indexOf('&') > 0) {
    id = id.substring(0, id.indexOf('&'));
  }
  return id;
}

export function urlToFolderId(url: string): string {
  if (url.match(/drive\.google\.com\/drive.*folders\//)) {
    const id = url.substring(url.indexOf('/folders/') + '/folders/'.length);
    return stripUrlSuffix(id);
  }

  if (url.match(/drive.google.com\/.*\/open/)) {
    url = url.replace(/drive.google.com\/.*\/open/, 'https://drive.google.com/open');
  }

  if (url.indexOf('https://drive.google.com/open?id%3D') > -1) {
    url = url.replace('https://drive.google.com/open?id%3D', 'https://drive.google.com/open?id=');
  }

  if (url.indexOf('https://drive.google.com/open?id=') > -1) {
    let id = url.substring(url.indexOf('https://drive.google.com/open?id=') + 'https://drive.google.com/open?id='.length);
    if (id.indexOf('&') > 0) {
      id = id.substring(0, id.indexOf('&'));
    }
    return id;
  }

  if (url.startsWith('https://docs.google.com/drawings/d/')) {
    const id = url.substring(url.indexOf('docs.google.com/drawings/d/') + 'docs.google.com/drawings/d/'.length);
    return stripUrlSuffix(id);
  }

  if (url.indexOf('docs.google.com/document/d/') > 0) {
    const id = url.substring(url.indexOf('docs.google.com/document/d/') + 'docs.google.com/document/d/'.length);
    return stripUrlSuffix(id);
  }

  if (url.match(/^[A-Z0-9_-]+$/ig)) {
    return url;
  }

  return null;
}
