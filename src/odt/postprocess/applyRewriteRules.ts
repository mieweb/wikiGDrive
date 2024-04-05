import {MarkdownNodes, MarkdownTextNode} from '../MarkdownNodes.ts';
import {chunksToText, walkRecursiveSync} from '../markdownNodesUtils.ts';
import {applyRewriteRule, RewriteRule} from '../applyRewriteRule.ts';

export function applyRewriteRules(markdownChunks: MarkdownNodes, rewriteRule: RewriteRule[] = []) {
  let inHtml = 0;
  walkRecursiveSync(markdownChunks.body, (chunk, ctx: { nodeIdx: number }) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml++;
      return;
    }

    if ('tag' in chunk && ['SVG/', 'IMG/'].includes(chunk.tag)) {
      let broke = false;
      for (const rule of rewriteRule) {
        const { shouldBreak, text } = applyRewriteRule(rule, {
          ...chunk,
          mode: inHtml ? 'html' : 'md',
          href: 'payload' in chunk ? chunk.payload?.href : undefined,
          alt: 'payload' in chunk ? chunk.payload?.alt : undefined
        });

        const textNode: MarkdownTextNode = {
          isTag: false,
          text,
          parent: undefined,
          comment: 'MarkdownNodes.ts: appendText'
        };
        chunk.parent.children.splice(ctx.nodeIdx, 1, textNode);

        if (shouldBreak) {
          // retVal.push(text);
          broke = true;
          break;
        }
      }

      if (broke) {
        // return retVal.join('');
      }
    }

    if ('tag' in chunk && 'A' === chunk.tag) {
      const alt = chunksToText(chunk.children, { ...ctx, mode: 'md', onlyNotTag: true });
      let broke = false;
      for (const rule of rewriteRule) {
        const { shouldBreak, text } = applyRewriteRule(rule, {
          ...chunk,
          mode: inHtml ? 'html' : 'md',
          href: 'payload' in chunk ? chunk.payload?.href : undefined,
          alt
        });

        const textNode: MarkdownTextNode = {
          isTag: false,
          text,
          parent: undefined,
          comment: 'MarkdownNodes.ts: appendText'
        };
        chunk.parent.children.splice(ctx.nodeIdx, 1, textNode);

        if (shouldBreak) {
          // retVal.push(text);
          broke = true;
          break;
        }
      }

      if (broke) {
        // return retVal.join('');
        // retVal.splice(chunkNo, matchingNo - chunkNo);
        //   return retVal;
      }
    }

  }, {}, (chunk) => {
    if (chunk.isTag && chunk.tag === 'HTML_MODE/') {
      inHtml--;
      return;
    }
  });

}
