import {MarkdownNodes} from '../MarkdownNodes.ts';
import {dump} from '../markdownNodesUtils.ts';

import {processListsAndNumbering} from './processListsAndNumbering.ts';
import {postProcessHeaders} from './postProcessHeaders.ts';
import {removePreWrappingAroundMacros} from './removePreWrappingAroundMacros.ts';
import {removeInsideDoubleCodeBegin} from './removeInsideDoubleCodeBegin.ts';
import {fixSpacesInsideInlineFormatting} from './fixSpacesInsideInlineFormatting.ts';
import {fixBoldItalic} from './fixBoldItalic.ts';
import {hideSuggestedChanges} from './hideSuggestedChanges.ts';
import {trimParagraphs} from './trimParagraphs.ts';
import {addEmptyLinesAfterParas} from './addEmptyLinesAfterParas.ts';
import {addEmptyLines} from './addEmptyLines.ts';
import {removeTdParas} from './removeTdParas.ts';
import {mergeTexts} from './mergeTexts.ts';
import {rewriteHeaders} from './rewriteHeaders.ts';
import {removeMarkdownMacro} from './removeMarkdownMacro.ts';

import {postProcessPreMacros} from './postProcessPreMacros.ts';
import {mergeParagraphs} from './mergeParagraphs.ts';
import {convertToc} from './convertToc.ts';
import {removeEmptyTags} from './removeEmptyTags.ts';
import {removeExcessiveLines} from './removeExcessiveLines.ts';
import {applyRewriteRules} from './applyRewriteRules.ts';
import {RewriteRule} from '../applyRewriteRule.ts';
import {convertMathMl} from './convertMathMl.ts';
import {unwrapEmptyPre} from './unwrapEmptyPre.ts';
import {convertGoogleUrls} from './convertGoogleUrls.ts';
import {fixIdLinks} from './fixIdLinks.ts';
import {convertCodeBlockParagraphs} from './convertCodeBlockParagraphs.ts';

export async function postProcess(chunks: MarkdownNodes, rewriteRules: RewriteRule[]) {
  convertToc(chunks);
  processListsAndNumbering(chunks);
  postProcessHeaders(chunks);
  fixSpacesInsideInlineFormatting(chunks);
  await fixBoldItalic(chunks);
  hideSuggestedChanges(chunks);
  convertCodeBlockParagraphs(chunks);
  convertMathMl(chunks);

  trimParagraphs(chunks);
  const { headersMap, invisibleBookmarks} = await rewriteHeaders(chunks);
  trimParagraphs(chunks);
  addEmptyLinesAfterParas(chunks);
  removeTdParas(chunks); // Requires: addEmptyLinesAfterParas

  mergeTexts(chunks);

  mergeParagraphs(chunks);
  unwrapEmptyPre(chunks);
  removePreWrappingAroundMacros(chunks);
  await removeMarkdownMacro(chunks);
  postProcessPreMacros(chunks);
  removeInsideDoubleCodeBegin(chunks);

  removeEmptyTags(chunks);
  addEmptyLines(chunks);

  fixIdLinks(chunks);
  removeExcessiveLines(chunks);

  convertGoogleUrls(chunks);

  applyRewriteRules(chunks, rewriteRules);

  if (process.env.DEBUG_COLORS) {
    dump(chunks.body);
  }

  return { headersMap, invisibleBookmarks };
}
