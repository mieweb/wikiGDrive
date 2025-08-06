export function relateUrl(from: string, to: string): string {
// Normalize paths by removing multiple slashes and ensuring leading slash
  function normalizePath(path: string): string {
    const match = path.match(/^(?:[a-zA-Z]+:\/\/[^\/]+)?(.*)$/) || [];
    return '/' + (match[1] || path).replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
  }

  // Check if 'to' is an absolute URL with a different domain
  const fromMatch = from.match(/^([a-zA-Z]+:\/\/[^\/]+)/);
  const toMatch = to.match(/^([a-zA-Z]+:\/\/[^\/]+)/);
  if (toMatch && (!fromMatch || fromMatch[1] !== toMatch[1])) {
    return to; // Return absolute URL if domains differ
  }

  // Split paths into segments
  const fromSegments: string[] = normalizePath(from).split('/');
  const toSegments: string[] = normalizePath(to).split('/');

  // Remove empty segments
  fromSegments.shift();
  toSegments.shift();

  // If 'from' is a file, remove the file name to get its directory
  if (fromSegments.length > 0 && fromSegments[fromSegments.length - 1].includes('.')) {
    fromSegments.pop(); // Remove file name
  }

  // Find common prefix
  let commonLength: number = 0;
  while (
    commonLength < fromSegments.length &&
    commonLength < toSegments.length &&
    fromSegments[commonLength] === toSegments[commonLength]
    ) {
    commonLength++;
  }

  // Calculate number of parent directories needed
  const upCount: number = fromSegments.length - commonLength;
  const relativeSegments: string[] = toSegments.slice(commonLength);

  // Build relative path
  let relativePath: string = '';
  if (upCount > 0 || relativeSegments.length > 0) {
    // Add parent directory references
    relativePath = '../'.repeat(upCount);

    // Add remaining segments
    relativePath += relativeSegments.join('/');
  } else {
    // Same directory
    relativePath = './';
  }

  // Handle case when to path is empty or root
  if (to === '' || to === '/' || (toMatch && to === toMatch[1] + '/')) {
    relativePath = '/';
  }

  return relativePath;
}

export function absolutizeUrl(fullPath: string, relativePath: string): string {
  // Normalize paths by removing multiple slashes and ensuring leading slash
  function normalizePath(path: string): string {
    return '/' + path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
  }

  // Parse URL to separate protocol, host, and path
  const urlRegex = /^(https?:\/\/[^\/]+)(\/.*)?$/;
  const match = fullPath.match(urlRegex);
  if (!match) {
    throw new Error('Invalid fullPath URL');
  }
  const baseUrl = match[1];
  let basePath = match[2] || '/';

  // Handle absolute URLs or root paths
  if (relativePath.match(/^[a-zA-Z]+:\/\//)) {
    return relativePath; // Return as-is if it's a full URL
  }

  // If relativePath starts with '/', treat it as an absolute path from the base URL
  if (relativePath.startsWith('/')) {
    return baseUrl + normalizePath(relativePath);
  }

  // Split basePath into segments and remove the file name if it's a path to a file
  const baseSegments: string[] = normalizePath(basePath).split('/');
  baseSegments.shift(); // Remove empty segment from leading /

  // If basePath is a file, remove the file name to treat it as a directory
  if (basePath.match(/\.[a-zA-Z0-9]+$/)) {
    baseSegments.pop();  // Remove the last segment if basePath points to a file
  }

  // Process relative path segments
  const relativeSegments: string[] = relativePath.split('/');
  const resultSegments: string[] = [...baseSegments];

  for (const segment of relativeSegments) {
    if (segment === '' || segment === '.') {
      continue; // Skip empty segments or '.' (current directory)
    } else if (segment === '..') {
      resultSegments.pop(); // Move up one directory for '..'
    } else {
      resultSegments.push(segment); // Add the segment to the result path
    }
  }

  // Construct absolute path
  const absolutePath: string = normalizePath('/' + resultSegments.join('/'));
  return baseUrl + absolutePath;
}
