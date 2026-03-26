import './importMetaPonyFill.ts';

import { CoreEditor } from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';

import { generateDocumentFrontMatter } from '../containers/transform/frontmatters/generateDocumentFrontMatter.ts';
import { urlToFolderId } from '../utils/idParsers.ts';
import { AssetUnzipper } from './AssetUnzipper.ts';
import type { WorkerPayload, WorkerResult } from './executeOdtToMarkdown.ts';

export async function executeOdtToMarkdown(
  workerData: WorkerPayload,
): Promise<WorkerResult> {
  const unzipper = new AssetUnzipper(
    workerData.odtPath,
    workerData.picturesDirAbsolute,
  );
  const fileMap = await unzipper.unzip((fileName) => {
    return fileName.startsWith('Pictures/');
  });

  const odtContent = Deno.readFileSync(workerData.odtPath);

  const editor = CoreEditor.create({
    assetLoad,
    uri: 'file://' + workerData.odtPath,
    editorKits: [
      new BrowserLessEditorKit(),
    ],
  });

  const links: Set<string> = new Set();

  const extOdt = editor.getExtension('odt')! as any;
  extOdt.urlFromRewriter = async (href: string, ctx: any) => {
    if (ctx.type === 'A') {
      const id = urlToFolderId(href);
      if (id) {
        href = 'gdoc:' + id;
      }
      links.add(href);
    }
    if (ctx.type === 'IMG') {
      if (fileMap[href]) {
        href = './' + workerData.realFileName.replace(/.md$/, '.assets/') +
          fileMap[href];
      } else {
        const id = urlToFolderId(href);
        if (id) {
          href = 'gdoc:' + id;
        } else {
          if (href.startsWith('https://docs.google.com/drawings/')) {
            console.log(href, id);
            throw new Error('bbb');
          }
        }
      }
    }
    return href;
  };

  await editor.loadDocument(
    'application/vnd.oasis.opendocument.text',
    odtContent,
  );
  const markdown = new TextDecoder().decode(
    await editor.saveDocument('text/x-markdown'),
  );

  const errors: string[] = []; // TODO
  const headersMap = {}; // TODO
  const invisibleBookmarks = {}; // TODO

  const frontMatterOverload: Record<string, string> = {};
  if (markdown.match(/^ *A. {2}/igm)) {
    frontMatterOverload['markup'] = 'pandoc';
  }

  const frontMatter = generateDocumentFrontMatter(
    workerData.localFile,
    Array.from(links),
    workerData.fm_without_version,
    frontMatterOverload,
  );

  return {
    links: Array.from(links),
    frontMatter,
    markdown,
    errors,
    headersMap,
    invisibleBookmarks,
  };
}
