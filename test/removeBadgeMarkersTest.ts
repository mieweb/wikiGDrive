import {removeBadgeMarkers} from '../src/odt/postprocess/removeBadgeMarkers.ts';
import {MarkdownNodes} from '../src/odt/MarkdownNodes.ts';

// Basic compilation and functionality test for badge marker removal
export function testRemoveBadgeMarkersCompiles() {
  console.log('Badge marker removal compilation test - removeBadgeMarkers can be imported');
  return true;
}

// Test that badge markers are removed correctly
export function testBadgeMarkersRemoval() {
  const chunks = new MarkdownNodes();
  
  // Add a text node with badge content
  chunks.body.children.push({
    isTag: false,
    text: 'Content before\n\n📍 WikiGDrive Badges: ✅ 2h ago 👁️ Preview 📍 End Badges\n\nContent after'
  });

  removeBadgeMarkers(chunks);

  const expectedText = 'Content before\n\nContent after';
  const actualText = chunks.body.children[0]?.text;
  
  if (actualText === expectedText) {
    console.log('✅ Badge marker removal test passed');
    return true;
  } else {
    console.log('❌ Badge marker removal test failed');
    console.log('Expected:', expectedText);
    console.log('Actual:', actualText);
    return false;
  }
}

// Test that content without badges is unchanged
export function testContentWithoutBadgesUnchanged() {
  const chunks = new MarkdownNodes();
  
  chunks.body.children.push({
    isTag: false,
    text: 'Regular content without any badges'
  });

  const originalText = chunks.body.children[0].text;
  removeBadgeMarkers(chunks);

  if (chunks.body.children[0].text === originalText) {
    console.log('✅ Content without badges unchanged test passed');
    return true;
  } else {
    console.log('❌ Content without badges test failed');
    return false;
  }
}

// Test that entire chunks are removed if they only contain badges
export function testBadgeOnlyChunkRemoval() {
  const chunks = new MarkdownNodes();
  
  chunks.body.children.push({
    isTag: false,
    text: '📍 WikiGDrive Badges: ✅ 2h ago 👁️ Preview 📍 End Badges'
  });
  
  chunks.body.children.push({
    isTag: false,
    text: 'Regular content'
  });

  removeBadgeMarkers(chunks);

  if (chunks.body.children.length === 1 && chunks.body.children[0].text === 'Regular content') {
    console.log('✅ Badge-only chunk removal test passed');
    return true;
  } else {
    console.log('❌ Badge-only chunk removal test failed');
    console.log('Children count:', chunks.body.children.length);
    console.log('First child text:', chunks.body.children[0]?.text);
    return false;
  }
}