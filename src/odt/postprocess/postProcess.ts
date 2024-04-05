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
import {removeTdParas} from './removeTdParas.js';
import {mergeTexts} from './mergeTexts.ts';
import {rewriteHeaders} from './rewriteHeaders.js';
import {removeMarkdownMacro} from './removeMarkdownMacro.js';

import {postProcessPreMacros} from './postProcessPreMacros.ts';
import {mergeParagraphs} from './mergeParagraphs.ts';
import {convertToc} from './convertToc.js';
import {removeEmptyTags} from './removeEmptyTags.js';
import {removeExcessiveLines} from './removeExcessiveLines.js';
import {applyRewriteRules} from './applyRewriteRules.js';
import {RewriteRule} from '../applyRewriteRule.js';

export async function postProcess(chunks: MarkdownNodes, rewriteRules: RewriteRule[]) {
  convertToc(chunks);
  processListsAndNumbering(chunks);
  postProcessHeaders(chunks);
  fixSpacesInsideInlineFormatting(chunks);
  await fixBoldItalic(chunks);
  hideSuggestedChanges(chunks);

  trimParagraphs(chunks);
  addEmptyLinesAfterParas(chunks);
  removeTdParas(chunks); // Requires: addEmptyLinesAfterParas

  mergeTexts(chunks);
  await rewriteHeaders(chunks);

  mergeParagraphs(chunks);
  removePreWrappingAroundMacros(chunks);
  await removeMarkdownMacro(chunks);
  postProcessPreMacros(chunks);
  removeInsideDoubleCodeBegin(chunks);

  removeEmptyTags(chunks);
  addEmptyLines(chunks);

  removeExcessiveLines(chunks);

  applyRewriteRules(chunks, rewriteRules);

  if (process.env.DEBUG_COLORS) {
    dump(chunks.body);
  }
}
