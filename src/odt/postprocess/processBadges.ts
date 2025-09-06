import { MarkdownNodes } from '../MarkdownNodes.ts';
import { BadgeSystem } from './badges/BadgeSystem.ts';
import { BadgeContext } from './badges/BadgeTypes.ts';

export function processBadges(chunks: MarkdownNodes, badgeContext?: BadgeContext): void {
  if (!badgeContext) {
    return;
  }

  const badgeSystem = new BadgeSystem();
  
  // Generate badge HTML
  const badgeHtml = badgeSystem.generateAndRenderBadges(badgeContext);
  
  if (!badgeHtml) {
    return;
  }

  // Find if there's already a badge container and remove it
  let badgeNodeIndex = -1;
  for (let i = 0; i < chunks.body.length; i++) {
    const node = chunks.body[i];
    if (typeof node === 'object' && node.tag === 'div' && 
        node.attr && node.attr.class === 'wikigdrive-badges') {
      badgeNodeIndex = i;
      break;
    }
  }

  // Remove existing badge node if found
  if (badgeNodeIndex >= 0) {
    chunks.body.splice(badgeNodeIndex, 1);
  }

  // Create a new badge node and insert at the beginning
  const badgeNode = {
    tag: 'div',
    attr: {
      class: 'wikigdrive-badges',
      style: 'margin: 10px 0; line-height: 1.4;'
    },
    list: [badgeHtml]
  };

  // Insert after any existing headers or at the beginning
  let insertIndex = 0;
  for (let i = 0; i < chunks.body.length; i++) {
    const node = chunks.body[i];
    if (typeof node === 'object' && node.tag && 
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag)) {
      insertIndex = i + 1;
      break;
    }
    if (typeof node === 'string' && node.trim() !== '') {
      break;
    }
  }

  chunks.body.splice(insertIndex, 0, badgeNode);
}