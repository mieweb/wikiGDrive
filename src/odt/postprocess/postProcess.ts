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
import {trimEndOfParagraphs} from './trimEndOfParagraphs.ts';
import {addEmptyLinesAfterParas} from './addEmptyLinesAfterParas.ts';
import {addEmptyLines} from './addEmptyLines.ts';
import {addIndentsAndBullets} from './addIndentsAndBullets.ts';
import {postProcessPreMacros} from './postProcessPreMacros.ts';
import {mergeParagraphs} from './mergeParagraphs.ts';
import {removeTdParas} from './removeTdParas.js';
import {mergeTexts} from './mergeTexts.ts';
import {rewriteHeaders} from './rewriteHeaders.js';
import {removeMarkdownMacro} from './removeMarkdownMacro.js';

export async function postProcess(chunks: MarkdownNodes) {
  removeTdParas(chunks);
  processListsAndNumbering(chunks);
  postProcessHeaders(chunks);
  removePreWrappingAroundMacros(chunks);
  removeInsideDoubleCodeBegin(chunks);
  fixSpacesInsideInlineFormatting(chunks);
  await fixBoldItalic(chunks);
  fixListParagraphs(chunks);
  hideSuggestedChanges(chunks);

  trimEndOfParagraphs(chunks);
  // mergeParagraphs(chunks, this.rewriteRules);

  addEmptyLinesAfterParas(chunks);
  addEmptyLines(chunks);
  // addIndentsAndBullets(chunks);
  mergeTexts(chunks);
  // postProcessPreMacros(chunks);
  await rewriteHeaders(chunks);
  await removeMarkdownMacro(chunks);

  if (process.env.DEBUG_COLORS) {
    dump(chunks.body);
  }
}
