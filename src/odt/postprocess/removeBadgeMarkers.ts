import {MarkdownNodes} from '../MarkdownNodes.ts';

/**
 * Removes wikiGDrive badge markers from the markdown content.
 * Badges are inserted into Google Docs for editor visibility but should not appear in final markdown output.
 */
export function removeBadgeMarkers(chunks: MarkdownNodes): void {
  const BADGE_MARKER_START = '📍 WikiGDrive Badges:';
  const BADGE_MARKER_END = '📍 End Badges';

  // Process all children in the document body
  for (let i = 0; i < chunks.body.children.length; i++) {
    const child = chunks.body.children[i];
    
    if (!child.isTag && child.text) {
      // This is a text node
      const text = child.text;
      
      // Find badge section and remove it entirely
      const startIndex = text.indexOf(BADGE_MARKER_START);
      if (startIndex !== -1) {
        const endIndex = text.indexOf(BADGE_MARKER_END);
        if (endIndex !== -1) {
          // Remove the entire badge section including markers
          const beforeBadge = text.substring(0, startIndex);
          const afterBadge = text.substring(endIndex + BADGE_MARKER_END.length);
          
          // Clean up any extra whitespace
          let cleanText = (beforeBadge + afterBadge).replace(/\n\n\n+/g, '\n\n').trim();
          
          if (cleanText) {
            child.text = cleanText;
          } else {
            // If the entire chunk was just badges, remove it
            chunks.body.children.splice(i, 1);
            i--; // Adjust index since we removed an element
          }
        }
      }
    } else if (child.isTag && child.children) {
      // This is a tag node, recursively process its children
      processBadgeRemovalInChildren(child.children, BADGE_MARKER_START, BADGE_MARKER_END);
    }
  }
}

/**
 * Recursively processes children of a tag node to remove badge markers
 */
function processBadgeRemovalInChildren(children: any[], startMarker: string, endMarker: string): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    if (!child.isTag && child.text) {
      // Text node - check for badge markers
      const text = child.text;
      const startIndex = text.indexOf(startMarker);
      
      if (startIndex !== -1) {
        const endIndex = text.indexOf(endMarker);
        if (endIndex !== -1) {
          // Remove badge content
          const beforeBadge = text.substring(0, startIndex);
          const afterBadge = text.substring(endIndex + endMarker.length);
          const cleanText = (beforeBadge + afterBadge).replace(/\n\n\n+/g, '\n\n').trim();
          
          if (cleanText) {
            child.text = cleanText;
          } else {
            // Remove empty child
            children.splice(i, 1);
            i--; // Adjust index
          }
        }
      }
    } else if (child.isTag && child.children) {
      // Recursively process nested children
      processBadgeRemovalInChildren(child.children, startMarker, endMarker);
    }
  }
}