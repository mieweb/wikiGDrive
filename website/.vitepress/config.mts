import {defineConfig, HeadConfig, TransformContext} from 'vitepress';
import { withSidebar } from 'vitepress-sidebar';
import {generateHead} from '../../html/generateHead.ts';

const vitePressConfigs = {
    title: "WikiGDrive",
    // description: "A VitePress Site",

    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,


    transformHtml(code: string, id: string, ctx: TransformContext) {
        return code
           .replaceAll('<!---->', '<!--v-if-->');

            // .replaceAll('<!--[-->', '<!--[--><!--x-->');
    // .replace('<!--[--><div id="main"', '<!--[--><!--x--><div id="main"');
    },
    markdown: {
        codeTransformers: [

            // We use `[!!code` in demo to prevent transformation, here we revert it back.
            {
                postprocess(code) {
                    return code
                        .replace(/\[\!\!code/g, '[!code')
                }
            }
        ]
    },
    head: generateHead() as HeadConfig[],
    themeConfig: {
        logo:  './images/logo.svg'
    }
}

// https://vitepress.dev/reference/site-config
export default defineConfig(withSidebar(vitePressConfigs, {
    documentRootPath: '/website/docs',
    includeRootIndexFile: false,
    basePath: '/docs',
    rootGroupText: 'Contents'
}));
