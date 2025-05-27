import { env } from 'node:process';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'npm:vite-plugin-wasm';

import {generateHead} from '../../website/generateHead.ts';
import type {DenoResolveResult} from './vite-plugins/resolver.ts';
import denoPrefixPlugin from "./vite-plugins/prefixPlugin.ts";
import denoPlugin from "./vite-plugins/resolvePlugin.ts";
import {denoCssPlugin} from './vite-plugins/denoCssPlugin.ts';
import { VitePluginWatchWorkspace } from './vite-plugins/VitePluginWatchWorkspace.ts';

const __dirname = import.meta.dirname!;

if (!env.BUILD_TIME) {
  env.BUILD_TIME = new Date().toISOString();
}
if (!env.VERSION) {
  env.VERSION = env.GIT_SHA || env.GITHUB_SHA || 'dev';
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
  // head.push(['script', { src: '/src/main.ts?GIT_SHA', type: 'module' }]);

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
  <meta name="generator" content="generateIndexHtml()" />
${renderHead()}
</head>
<body>
  <div id="app">${content}</div>${inlinedScript}
  <script type="module" src="/src/main.ts"></script>
</body>
</html>`;
  return html;
}

const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html: string) {
      // html = generateIndexHtml();
      return html.replace(
        /GIT_SHA/g,
        env.VERSION,
      );
    },
  };
};

const cache = new Map<string, DenoResolveResult>();

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
    denoPrefixPlugin(cache),
    denoPlugin(cache, __dirname + '/../../'),
    denoCssPlugin(__dirname + '/../../'),
    VitePluginWatchWorkspace({
      workspaceRoot: __dirname + '/../../',
      currentPackage: __dirname,
      format: 'esm',
      fileTypes: ['ts', 'vue'],
      ignorePaths: ['node_modules', 'dist', '.deno'],
    }),
    htmlPlugin(),
  ],
  publicDir: './public',
  resolve: {
    alias: {
      // 'vue/server-renderer': '@vue/server-renderer/dist/server-renderer.esm-bundler.js',
      vue: 'vue/dist/vue.esm-bundler.js',
    }
  },
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    manifest: true
  },
  define: {
    'import.meta.env.GIT_SHA': JSON.stringify(env.GIT_SHA || env.GITHUB_SHA || 'dev'),
    'import.meta.env.BUILD_TIME': JSON.stringify(env.BUILD_TIME),
    'import.meta.env.VERSION': JSON.stringify(env.VERSION),
    'import.meta.env.VITE_APP_ZIPKIN_SERVICE': JSON.stringify(env.ZIPKIN_SERVICE)
  },
  clearScreen: false,
});
