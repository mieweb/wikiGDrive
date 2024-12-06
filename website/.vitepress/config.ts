import fs from 'node:fs';
import path from 'node:path';

import {defineConfig} from 'vitepress';
import type {HeadConfig, TransformContext} from 'vitepress';
import {withSidebar} from 'vitepress-sidebar';
import {generateHead} from '../generateHead.ts';

const __dirname = import.meta.dirname;

function viteManifestToHead() {
  const head: HeadConfig[] = generateHead() as HeadConfig[];

  try {
    const buffer = fs.readFileSync(path.resolve(__dirname, '..', '..', 'apps', 'ui', 'dist', '.vite', 'manifest.json'));
    const manifest = JSON.parse(new TextDecoder().decode(buffer));

    if (manifest['index.html'] && manifest['index.html'].file) {
      head.push(['script', { src: manifest['index.html'].file.replace(/^assets/, '/assets'), type: 'module', crossorigin: '' }]);
    }
  } catch (error) {
    console.warn(error);
  }

  return head;
}

const head: HeadConfig[] = viteManifestToHead();

const vitePressConfigs = {
    title: 'WikiGDrive',
    // description: "A VitePress Site",

    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,

    transformHtml(code: string, id: string, ctx: TransformContext) {
        const scriptRegex = /<script type="module" src="\/assets\/[^"]+"><\/script>/g;
        if (id.endsWith('404.html')) {
            code = code.replace('<div id="app">', '<div id="app">' + ctx.content);
        }
        return code.replace(scriptRegex, '');
    },
    markdown: {
        codeTransformers: [

            // We use `[!!code` in demo to prevent transformation, here we revert it back.
            {
                postprocess(code: string) {
                    return code
                        .replace(/\[!!code/g, '[!code');
                }
            }
        ]
    },
    head,
    themeConfig: {
        logo:  './images/logo.svg'
    },
    buildEnd() {
      fs.cpSync(path.resolve(__dirname, '..', '..', 'apps', 'ui', 'dist', 'assets'), path.resolve(__dirname, 'dist', 'assets'), {recursive: true});
      console.log('buildEnd, copied vite UI assets');
    }
};

// https://vitepress.dev/reference/site-config
export default defineConfig(withSidebar(vitePressConfigs, {
    documentRootPath: '/docs',
    includeRootIndexFile: false,
    basePath: '/docs',
    rootGroupText: 'Contents'
}));
