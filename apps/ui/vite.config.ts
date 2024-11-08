import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import {generateHead} from '../../html/generateHead.ts';

if (!process.env.BUILD_TIME) {
  process.env.BUILD_TIME = new Date().toISOString();
}
if (!process.env.VERSION) {
  process.env.VERSION = process.env.GIT_SHA || process.env.GITHUB_SHA || 'dev';
}

function escapeHtml(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&(?![\w#]+;)/g, '&amp;');
}

function renderHead() {
  const retVal = [];

  const head = generateHead();

  for (const header of head) {
    const rest = [];
    const map = header[1];
    for (const key in map) {
      const value = map[key];
      rest.push(`${key}="${escapeHtml(value)}"`);
    }

    switch (header[0]) {
      case 'script':
        retVal.push(`<${header[0]} ${rest.join(' ')} ></${header[0]}>`);
        break;
      default:
        retVal.push(`<${header[0]} ${rest.join(' ')} />`);
        break;
    }
  }

  return retVal.join('\n');
}

export function generateIndexHtml() {
  const inlinedScript = '';
  const description = '';
  const content = '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>WikiGDrive</title>
  <meta name="description" content="${description}" />
${renderHead()}
</head>
<body>
  <div id="app">${content}</div>${inlinedScript}
</body>
</html>`;
  return html;
}

const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml() {
      return generateIndexHtml().replace(
        /GIT_SHA/g,
        process.env.VERSION,
      );
    },
  };
};

export default defineConfig({
  plugins: [
    vue(),
    htmlPlugin()
  ],
  publicDir: '../../html/public',
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    }
  },
  build: {
    sourcemap: true,
    manifest: true,
    target: 'esnext'
  },
  define: {
    'import.meta.env.GIT_SHA': JSON.stringify(process.env.GIT_SHA || process.env.GITHUB_SHA || 'dev'),
    'import.meta.env.BUILD_TIME': JSON.stringify(process.env.BUILD_TIME),
    'import.meta.env.VERSION': JSON.stringify(process.env.VERSION),
    'import.meta.env.VITE_APP_ZIPKIN_SERVICE': JSON.stringify(process.env.ZIPKIN_SERVICE)
  }
});
