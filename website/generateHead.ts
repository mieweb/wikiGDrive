import process from 'node:process';

export function generateHead(): unknown[] {
  return [
    ['link', { rel: 'stylesheet', type: 'text/css', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css' }],

    ['link', { rel: 'stylesheet', type: 'text/css', href: 'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css', media: '(prefers-color-scheme: light)' }],
    ['link', { rel: 'stylesheet', type: 'text/css', href: 'https://cdn.jsdelivr.net/npm/bootstrap-dark-5@1.1.3/dist/css/bootstrap-night.min.css', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    ['meta', { name: 'theme-color', content: '#111111', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#eeeeee', media: '(prefers-color-scheme: light)' }],

    ['link', { rel: 'stylesheet', type: 'text/css', href: '/assets/main.css?GIT_SHA' }],
    ['link', { rel: 'stylesheet', type: 'text/css', href: '/assets/prism.css?GIT_SHA', media: '(prefers-color-scheme: light)' }],
    ['link', { rel: 'stylesheet', type: 'text/css', href: '/assets/prism-dark.css?GIT_SHA', media: '(prefers-color-scheme: dark)' }],

    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/images/logo.svg?GIT_SHA' }],

    ['script', { src: '/assets/prism.js?GIT_SHA' }],
    // ['script', { src: '/src/main.ts?GIT_SHA', type: 'module' }],
  ].map(header => {
    if (header.length > 0) {
      for (const key of Object.keys(header[1])) {
        header[1][key] = header[1][key].replaceAll('GIT_SHA', process.env.GIT_SHA || process.env.GITHUB_SHA || 'dev');
      }
    }
    return header;
  });
}
