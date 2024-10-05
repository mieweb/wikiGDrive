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

  if (id.match(/^[A-Z0-9_-]+$/ig)) {
    return id;
  }
  return null;
}

export function replaceUrlsWithIds(text: string): string {
  text = text.replaceAll('https://drive.google.com/open?id%3D', 'https://drive.google.com/open?id=');
  text = text.replaceAll('https://drive.google.com/open?id=', 'gdoc:');
  return text;
}

export function urlToFolderId(url: string): string | null {
  if (!url) {
    return null;
  }
  url = url.replaceAll('../', '');

  if (url.match(/drive\.google\.com\/drive.*folders\//)) {
    const id = url.substring(url.indexOf('/folders/') + '/folders/'.length);
    return stripUrlSuffix(id);
  }

  if (url.match(/drive.google.com\/.*\/open/)) {
    url = url.replace(/drive.google.com\/.*\/open/, 'https://drive.google.com/open');
  }

  if (url.startsWith('http://drive.google.com/')) {
    url = url.replace('http://drive.google.com/', 'https://drive.google.com/');
  }

  if (url.indexOf('https://drive.google.com/open?id%3D') > -1) {
    url = url.replace('https://drive.google.com/open?id%3D', 'https://drive.google.com/open?id=');
  }

  if (url.indexOf('https://drive.google.com/open?id=') > -1) {
    let id = url.substring(url.indexOf('https://drive.google.com/open?id=') + 'https://drive.google.com/open?id='.length);
    if (id.indexOf('&') > 0) {
      id = id.substring(0, id.indexOf('&'));
    }
    if (id.match(/^[A-Z0-9_-]+$/ig)) {
      return id;
    }
    return null;
  }

  if (url.startsWith('https://docs.google.com/drawings/')) {
    const id = url.split('/d/')[1];
    return stripUrlSuffix(id);
  }

  if (url.indexOf('docs.google.com/document/') > 0) {
    const id = url.split('/d/')[1];
    return stripUrlSuffix(id);
  }

  if (url.match(/^[A-Z0-9_-]+$/ig)) {
    return url;
  }

  return null;
}

export function getUrlHash(url: string): string {
  const idx = url.indexOf('#');
  if (idx >= 0 && idx < url.length - 1) {
    return url.substring(idx).replace('#heading=h.', '#_');
  }
  return '';
}
