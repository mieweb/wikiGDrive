export function parseSecondsInterval(str) {
  if (!str) {
    return 0;
  }

  if (typeof str === 'string') {
    if (str.endsWith('s')) {
      return parseInt(str.substring(0, str.length - 1)) || 0;
    }
    if (str.endsWith('m')) {
      return parseInt(str.substring(0, str.length - 1)) * 60 || 0;
    }
    if (str.endsWith('h')) {
      return parseInt(str.substring(0, str.length - 1)) * 3600 || 0;
    }
    if (str.endsWith('d')) {
      return parseInt(str.substring(0, str.length - 1)) * 3600 * 24 || 0;
    }
    if (str.endsWith('w')) {
      return parseInt(str.substring(0, str.length - 1)) * 3600 * 24 * 7 || 0;
    }
  }

  return 0;
}
