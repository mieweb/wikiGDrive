import {MarkdownNodes} from '../MarkdownNodes.ts';
import {dump} from '../markdownNodesUtils.ts';

import {processListsAndNumbering} from './processListsAndNumbering.ts';
import {postProcessHeaders} from './postProcessHeaders.ts';
import {removePreWrappingAroundMacros} from './removePreWrappingAroundMacros.ts';
import {removeInsideDoubleCodeBegin} from './removeInsideDoubleCodeBegin.ts';
import {fixSpacesInsideInlineFormatting} from './fixSpacesInsideInlineFormatting.ts';
import {fixBoldItalic} from './fixBoldItalic.ts';
import {fixListParagraphs} from './fixListParagraphs.ts';
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

export async function postProcess(chunks: MarkdownNodes) {
  convertToc(chunks);
  processListsAndNumbering(chunks);
  postProcessHeaders(chunks);
  removePreWrappingAroundMacros(chunks);
  removeInsideDoubleCodeBegin(chunks);
  fixSpacesInsideInlineFormatting(chunks);
  await fixBoldItalic(chunks);
  fixListParagraphs(chunks);
  hideSuggestedChanges(chunks);

  trimParagraphs(chunks);
  addEmptyLinesAfterParas(chunks);
  removeTdParas(chunks); // Requires: addEmptyLinesAfterParas

  // addIndentsAndBullets(chunks);
  mergeTexts(chunks);
  await rewriteHeaders(chunks);
  await removeMarkdownMacro(chunks);

  // TODO macros
  mergeParagraphs(chunks);
  postProcessPreMacros(chunks);

  removeEmptyTags(chunks);
  addEmptyLines(chunks);

  removeExcessiveLines(chunks);

  if (process.env.DEBUG_COLORS) {
    dump(chunks.body);
  }
}
